"""
Celery tasks for Prospector Agent

Background tasks for:
- Daily Google Places scraping
- Website scraping for leads
- Batch score updates
- Data cleanup

All tasks include comprehensive error handling and retry logic.
"""
import logging
from typing import Dict, Any, List
from datetime import datetime, timedelta
from celery import Task
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from .celery_app import celery_app
from ..models.database import SessionLocal
from ..models.lead import Lead, LeadStatus, LeadSource, LeadProduct
from ..scraper.google_places import GooglePlacesScraper
from ..scraper.website_scraper import WebsiteScraper
from ..utils.scoring import LeadScorer

logger = logging.getLogger(__name__)


class DatabaseTask(Task):
    """Base task with database session management"""

    _db: Session = None

    @property
    def db(self) -> Session:
        """Get database session"""
        if self._db is None:
            self._db = SessionLocal()
        return self._db

    def after_return(self, *args, **kwargs):
        """Clean up database session after task completes"""
        if self._db is not None:
            self._db.close()
            self._db = None


@celery_app.task(
    bind=True,
    base=DatabaseTask,
    name="app.scheduler.tasks.daily_google_places_scrape",
    max_retries=3,
    default_retry_delay=300,  # 5 minutes
)
def daily_google_places_scrape(self) -> Dict[str, Any]:
    """
    Daily Google Places scraping task

    Scrapes multiple locations and search queries for auto parts suppliers.
    Runs daily at 2 AM UTC.

    Returns:
        Summary of scraping results
    """
    try:
        logger.info("Starting daily Google Places scrape")

        # Define search configurations
        search_configs = [
            # Major Tunisian cities
            {"query": "auto parts supplier", "location": "Tunis, Tunisia", "radius": 20000, "max_results": 50},
            {"query": "pièces détachées auto", "location": "Tunis, Tunisia", "radius": 20000, "max_results": 50},
            {"query": "auto parts supplier", "location": "Sfax, Tunisia", "radius": 15000, "max_results": 30},
            {"query": "pièces détachées auto", "location": "Sfax, Tunisia", "radius": 15000, "max_results": 30},
            {"query": "auto parts supplier", "location": "Sousse, Tunisia", "radius": 15000, "max_results": 30},
            {"query": "pièces détachées auto", "location": "Sousse, Tunisia", "radius": 15000, "max_results": 30},
            # Specific searches
            {"query": "fournisseur pièces automobile", "location": "Tunis, Tunisia", "radius": 20000, "max_results": 40},
            {"query": "distributeur pièces auto", "location": "Tunis, Tunisia", "radius": 20000, "max_results": 40},
        ]

        scraper = GooglePlacesScraper()
        total_created = 0
        total_existing = 0
        total_failed = 0

        for config in search_configs:
            try:
                logger.info(f"Scraping: {config['query']} in {config['location']}")

                summary = scraper.scrape_and_store(
                    query=config["query"],
                    location=config["location"],
                    db=self.db,
                    radius=config["radius"],
                    max_results=config["max_results"]
                )

                total_created += summary.get("created", 0)
                total_existing += summary.get("existing", 0)
                total_failed += summary.get("failed", 0)

                logger.info(
                    f"Completed {config['query']}: "
                    f"{summary.get('created', 0)} new, "
                    f"{summary.get('existing', 0)} existing"
                )

            except Exception as e:
                logger.error(
                    f"Error scraping {config['query']} in {config['location']}: {str(e)}",
                    exc_info=True
                )
                total_failed += 1
                continue

        result = {
            "success": True,
            "timestamp": datetime.utcnow().isoformat(),
            "total_created": total_created,
            "total_existing": total_existing,
            "total_failed": total_failed,
            "searches_completed": len(search_configs) - total_failed,
            "searches_total": len(search_configs)
        }

        logger.info(f"Daily scrape completed: {result}")
        return result

    except Exception as e:
        logger.error(f"Fatal error in daily Google Places scrape: {str(e)}", exc_info=True)

        # Retry with exponential backoff
        try:
            raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))
        except self.MaxRetriesExceededError:
            logger.error("Max retries exceeded for daily scrape")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }


@celery_app.task(
    bind=True,
    base=DatabaseTask,
    name="app.scheduler.tasks.scrape_lead_websites",
    max_retries=3,
    default_retry_delay=180,  # 3 minutes
)
def scrape_lead_websites(self, limit: int = 20) -> Dict[str, Any]:
    """
    Scrape websites for leads that have websites but no products

    Finds leads with:
    - has_website = True
    - website_url is not null
    - No associated products (or very few)
    - Status is NEW or CONTACTED

    Args:
        limit: Maximum number of websites to scrape per run

    Returns:
        Summary of scraping results
    """
    try:
        logger.info(f"Starting website scraping for up to {limit} leads")

        # Find leads with websites but no products
        leads = self.db.query(Lead).filter(
            and_(
                Lead.has_website == True,
                Lead.website_url.isnot(None),
                Lead.status.in_([LeadStatus.NEW, LeadStatus.CONTACTED])
            )
        ).outerjoin(LeadProduct).group_by(Lead.id).having(
            self.db.func.count(LeadProduct.id) < 5  # Less than 5 products
        ).order_by(
            Lead.potential_score.desc()  # Prioritize high-score leads
        ).limit(limit).all()

        logger.info(f"Found {len(leads)} leads to scrape")

        scraper = WebsiteScraper()
        successful = 0
        failed = 0
        total_products = 0
        errors: List[Dict[str, str]] = []

        for lead in leads:
            try:
                logger.info(f"Scraping website for lead {lead.id}: {lead.website_url}")

                # Use Playwright for JavaScript-heavy sites
                result = scraper.scrape_and_store_products(
                    lead=lead,
                    db=self.db,
                    use_playwright=False  # Start with simple scraper
                )

                if result.get("success"):
                    successful += 1
                    total_products += result.get("products_added", 0)

                    # If no products found with simple scraper, try Playwright
                    if result.get("products_added", 0) == 0:
                        logger.info(f"Retrying with Playwright for {lead.website_url}")
                        playwright_result = scraper.scrape_and_store_products(
                            lead=lead,
                            db=self.db,
                            use_playwright=True
                        )
                        if playwright_result.get("success"):
                            total_products += playwright_result.get("products_added", 0)
                else:
                    failed += 1
                    errors.append({
                        "lead_id": str(lead.id),
                        "url": lead.website_url,
                        "error": result.get("error", "Unknown error")
                    })

            except Exception as e:
                logger.error(f"Error scraping lead {lead.id}: {str(e)}", exc_info=True)
                failed += 1
                errors.append({
                    "lead_id": str(lead.id),
                    "url": lead.website_url,
                    "error": str(e)
                })
                continue

        result = {
            "success": True,
            "timestamp": datetime.utcnow().isoformat(),
            "leads_processed": len(leads),
            "successful": successful,
            "failed": failed,
            "total_products_added": total_products,
            "errors": errors[:10]  # Limit to first 10 errors
        }

        logger.info(f"Website scraping completed: {result}")
        return result

    except Exception as e:
        logger.error(f"Fatal error in website scraping task: {str(e)}", exc_info=True)

        # Retry with exponential backoff
        try:
            raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))
        except self.MaxRetriesExceededError:
            logger.error("Max retries exceeded for website scraping")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }


@celery_app.task(
    bind=True,
    base=DatabaseTask,
    name="app.scheduler.tasks.batch_update_lead_scores",
    max_retries=2,
    default_retry_delay=120,  # 2 minutes
)
def batch_update_lead_scores(self, limit: int = 500) -> Dict[str, Any]:
    """
    Batch update lead scores

    Recalculates potential scores for leads based on:
    - New product data
    - Updated contact information
    - Changed Google ratings

    Args:
        limit: Maximum number of leads to update per run

    Returns:
        Summary of score updates
    """
    try:
        logger.info(f"Starting batch score update for up to {limit} leads")

        scorer = LeadScorer()
        result = scorer.batch_update_scores(self.db, limit=limit)

        result["timestamp"] = datetime.utcnow().isoformat()

        logger.info(f"Batch score update completed: {result}")
        return result

    except Exception as e:
        logger.error(f"Fatal error in batch score update: {str(e)}", exc_info=True)

        # Retry with exponential backoff
        try:
            raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))
        except self.MaxRetriesExceededError:
            logger.error("Max retries exceeded for batch score update")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }


@celery_app.task(
    bind=True,
    base=DatabaseTask,
    name="app.scheduler.tasks.cleanup_old_data",
    max_retries=2,
    default_retry_delay=300,  # 5 minutes
)
def cleanup_old_data(self, days_old: int = 180) -> Dict[str, Any]:
    """
    Clean up old and stale data

    Removes:
    - Rejected leads older than specified days
    - Leads with very low scores and no activity
    - Orphaned product records

    Args:
        days_old: Number of days to consider data as old

    Returns:
        Summary of cleanup operations
    """
    try:
        logger.info(f"Starting cleanup of data older than {days_old} days")

        cutoff_date = datetime.utcnow() - timedelta(days=days_old)

        # Delete old rejected leads
        rejected_deleted = self.db.query(Lead).filter(
            and_(
                Lead.status == LeadStatus.REJECTED,
                Lead.scraped_at < cutoff_date
            )
        ).delete(synchronize_session=False)

        # Delete low-score inactive leads (score < 20, older than 90 days)
        low_score_cutoff = datetime.utcnow() - timedelta(days=90)
        low_score_deleted = self.db.query(Lead).filter(
            and_(
                Lead.potential_score < 20,
                Lead.status == LeadStatus.NEW,
                Lead.scraped_at < low_score_cutoff
            )
        ).delete(synchronize_session=False)

        # Delete orphaned products (products with no associated lead)
        orphaned_products = self.db.query(LeadProduct).filter(
            ~LeadProduct.lead_id.in_(
                self.db.query(Lead.id)
            )
        ).delete(synchronize_session=False)

        self.db.commit()

        result = {
            "success": True,
            "timestamp": datetime.utcnow().isoformat(),
            "rejected_leads_deleted": rejected_deleted,
            "low_score_leads_deleted": low_score_deleted,
            "orphaned_products_deleted": orphaned_products,
            "total_deleted": rejected_deleted + low_score_deleted + orphaned_products
        }

        logger.info(f"Cleanup completed: {result}")
        return result

    except Exception as e:
        logger.error(f"Fatal error in cleanup task: {str(e)}", exc_info=True)
        self.db.rollback()

        # Retry with exponential backoff
        try:
            raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))
        except self.MaxRetriesExceededError:
            logger.error("Max retries exceeded for cleanup")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }


# Manual task for testing (can be called from API)
@celery_app.task(
    bind=True,
    base=DatabaseTask,
    name="app.scheduler.tasks.scrape_specific_location",
    max_retries=2,
)
def scrape_specific_location(
    self,
    query: str,
    location: str,
    radius: int = 10000,
    max_results: int = 30
) -> Dict[str, Any]:
    """
    Scrape a specific location (manual task)

    Can be triggered manually via API or admin interface.

    Args:
        query: Search query
        location: Location string
        radius: Search radius in meters
        max_results: Maximum results to process

    Returns:
        Scraping summary
    """
    try:
        logger.info(f"Manual scrape: {query} in {location}")

        scraper = GooglePlacesScraper()
        summary = scraper.scrape_and_store(
            query=query,
            location=location,
            db=self.db,
            radius=radius,
            max_results=max_results
        )

        summary["timestamp"] = datetime.utcnow().isoformat()
        logger.info(f"Manual scrape completed: {summary}")
        return summary

    except Exception as e:
        logger.error(f"Error in manual scrape: {str(e)}", exc_info=True)

        try:
            raise self.retry(exc=e, countdown=60)
        except self.MaxRetriesExceededError:
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }


@celery_app.task(
    bind=True,
    base=DatabaseTask,
    name="app.scheduler.tasks.send_weekly_report",
    max_retries=3,
    default_retry_delay=300,  # 5 minutes
)
def send_weekly_report(self) -> Dict[str, Any]:
    """
    Generate and send weekly report email

    Generates comprehensive weekly report and emails it to configured recipients.
    Runs weekly on Monday at 9:00 AM UTC.

    Returns:
        Summary of report generation and email sending
    """
    try:
        from ..utils.report_generator import ReportGenerator
        from ..utils.email_service import EmailService
        from ..config import settings

        logger.info("Starting weekly report generation")

        # Generate report
        report_generator = ReportGenerator()
        report_data = report_generator.generate_weekly_report(self.db)

        # Format as HTML
        html_report = report_generator.format_report_as_html(report_data)

        # Parse recipient emails
        recipients = [
            email.strip()
            for email in settings.REPORT_RECIPIENTS.split(",")
            if email.strip()
        ]

        if not recipients:
            logger.warning("No report recipients configured")
            return {
                "success": False,
                "error": "No recipients configured",
                "timestamp": datetime.utcnow().isoformat()
            }

        # Send email
        email_service = EmailService()
        email_sent = email_service.send_weekly_report(
            to_emails=recipients,
            html_report=html_report
        )

        result = {
            "success": email_sent,
            "timestamp": datetime.utcnow().isoformat(),
            "recipients": recipients,
            "report_summary": {
                "total_leads": report_data["summary"]["total_leads"],
                "new_leads_this_week": report_data["summary"]["new_leads_this_week"],
                "new_products_this_week": report_data["summary"]["new_products_this_week"],
            }
        }

        if email_sent:
            logger.info(f"Weekly report sent successfully to {len(recipients)} recipients")
        else:
            logger.error("Failed to send weekly report email")

        return result

    except Exception as e:
        logger.error(f"Fatal error in weekly report generation: {str(e)}", exc_info=True)

        # Retry with exponential backoff
        try:
            raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))
        except self.MaxRetriesExceededError:
            logger.error("Max retries exceeded for weekly report")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
