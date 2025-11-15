"""
Scraping API routes
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
import logging

from ..models import get_db
from ..models.schemas import (
    GooglePlacesScrapeRequest,
    GooglePlacesScrapeResponse
)
from ..scraper.google_places import GooglePlacesScraper
from ..config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/scrape", tags=["scraping"])


def run_google_places_scrape(
    query: str,
    location: str,
    radius: int,
    max_results: int,
    db: Session
):
    """
    Background task to run Google Places scraping

    Args:
        query: Search query
        location: Location string
        radius: Search radius in meters
        max_results: Maximum results to process
        db: Database session
    """
    try:
        scraper = GooglePlacesScraper()
        summary = scraper.scrape_and_store(
            query=query,
            location=location,
            db=db,
            radius=radius,
            max_results=max_results
        )

        logger.info(f"Google Places scrape completed: {summary}")

    except Exception as e:
        logger.error(f"Error in background scrape: {str(e)}", exc_info=True)
    finally:
        db.close()


@router.post("/google-places", response_model=GooglePlacesScrapeResponse)
async def scrape_google_places(
    request: GooglePlacesScrapeRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Scrape leads from Google Places API

    Args:
        request: Scraping parameters
        background_tasks: FastAPI background tasks
        db: Database session

    Returns:
        Scraping task info
    """
    try:
        # Validate API key
        if not settings.GOOGLE_PLACES_API_KEY:
            raise HTTPException(
                status_code=500,
                detail="Google Places API key not configured"
            )

        # Run scraping in background
        background_tasks.add_task(
            run_google_places_scrape,
            query=request.query,
            location=request.location,
            radius=request.radius,
            max_results=request.max_results,
            db=db
        )

        logger.info(
            f"Google Places scrape task queued: "
            f"query='{request.query}', location='{request.location}'"
        )

        return GooglePlacesScrapeResponse(
            success=True,
            message="Scraping task started successfully",
            leads_found=0,  # Will be updated when task completes
            task_id=None  # Could use Celery task ID if using Celery
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting scrape: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/google-places/sync", response_model=GooglePlacesScrapeResponse)
async def scrape_google_places_sync(
    request: GooglePlacesScrapeRequest,
    db: Session = Depends(get_db)
):
    """
    Scrape leads from Google Places API (synchronous)

    Runs the scraping task synchronously and returns results.
    Use the async endpoint for better performance.

    Args:
        request: Scraping parameters
        db: Database session

    Returns:
        Scraping results
    """
    try:
        # Validate API key
        if not settings.GOOGLE_PLACES_API_KEY:
            raise HTTPException(
                status_code=500,
                detail="Google Places API key not configured"
            )

        # Run scraping synchronously
        scraper = GooglePlacesScraper()
        summary = scraper.scrape_and_store(
            query=request.query,
            location=request.location,
            db=db,
            radius=request.radius,
            max_results=request.max_results
        )

        logger.info(f"Google Places scrape completed: {summary}")

        return GooglePlacesScrapeResponse(
            success=True,
            message=f"Scraping completed: {summary['created']} new leads created, "
                   f"{summary['existing']} already existed",
            leads_found=summary['created'],
            task_id=None
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in sync scrape: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/website/{lead_id}")
async def scrape_lead_website(
    lead_id: str,
    use_playwright: bool = False,
    db: Session = Depends(get_db)
):
    """
    Scrape products from a lead's website

    Args:
        lead_id: Lead UUID
        use_playwright: Use Playwright for JavaScript-heavy sites
        db: Database session

    Returns:
        Scraping results
    """
    try:
        # Import here to avoid circular dependency
        from ..models.lead import Lead
        from ..scraper.website_scraper import WebsiteScraper

        # Get lead
        lead = db.query(Lead).filter(Lead.id == lead_id).first()
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")

        if not lead.website_url:
            raise HTTPException(
                status_code=400,
                detail="Lead does not have a website URL"
            )

        # Scrape website
        scraper = WebsiteScraper()
        result = await scraper.scrape_and_store_products(
            lead=lead,
            db=db,
            use_playwright=use_playwright
        )

        logger.info(f"Website scrape completed for lead {lead_id}: {result}")

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error scraping website for lead {lead_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tasks/trigger/{task_name}")
async def trigger_task(
    task_name: str,
    query: str = None,
    location: str = None,
    radius: int = 10000,
    max_results: int = 30,
    limit: int = None
):
    """
    Manually trigger a background task

    Args:
        task_name: Name of task to trigger (google-scrape, website-scrape, score-update, cleanup)
        query: Search query (for google-scrape)
        location: Location string (for google-scrape)
        radius: Search radius in meters (for google-scrape)
        max_results: Maximum results (for google-scrape)
        limit: Limit for batch operations

    Returns:
        Task info and ID
    """
    try:
        from ..scheduler.tasks import (
            scrape_specific_location,
            scrape_lead_websites,
            batch_update_lead_scores,
            cleanup_old_data
        )

        task_result = None

        if task_name == "google-scrape":
            if not query or not location:
                raise HTTPException(
                    status_code=400,
                    detail="query and location are required for google-scrape"
                )
            task_result = scrape_specific_location.delay(query, location, radius, max_results)

        elif task_name == "website-scrape":
            task_result = scrape_lead_websites.delay(limit or 20)

        elif task_name == "score-update":
            task_result = batch_update_lead_scores.delay(limit or 500)

        elif task_name == "cleanup":
            task_result = cleanup_old_data.delay(180)

        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown task: {task_name}. Valid tasks: google-scrape, website-scrape, score-update, cleanup"
            )

        logger.info(f"Task {task_name} triggered: {task_result.id}")

        return {
            "success": True,
            "task_name": task_name,
            "task_id": task_result.id,
            "status": "queued",
            "message": f"Task {task_name} has been queued successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error triggering task {task_name}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tasks/status/{task_id}")
async def get_task_status(task_id: str):
    """
    Get status of a background task

    Args:
        task_id: Celery task ID

    Returns:
        Task status and result
    """
    try:
        from celery.result import AsyncResult
        from ..scheduler.celery_app import celery_app

        task_result = AsyncResult(task_id, app=celery_app)

        response = {
            "task_id": task_id,
            "status": task_result.status,
            "ready": task_result.ready(),
            "successful": task_result.successful() if task_result.ready() else None,
        }

        if task_result.ready():
            if task_result.successful():
                response["result"] = task_result.result
            else:
                response["error"] = str(task_result.result)

        return response

    except Exception as e:
        logger.error(f"Error getting task status {task_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
