"""
Weekly Report Generator

Generates comprehensive weekly reports for business owner including:
- New leads discovered
- Top scoring leads
- Products scraped
- Statistics and trends
"""
import logging
from typing import Dict, Any, List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, desc

from ..models.lead import Lead, LeadStatus, LeadSource, LeadProduct

logger = logging.getLogger(__name__)


class ReportGenerator:
    """
    Generates weekly reports with lead statistics and insights
    """

    def __init__(self):
        """Initialize report generator"""
        self.logger = logger

    def generate_weekly_report(self, db: Session) -> Dict[str, Any]:
        """
        Generate comprehensive weekly report

        Args:
            db: Database session

        Returns:
            Report data dictionary
        """
        try:
            # Calculate date range (last 7 days)
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=7)

            self.logger.info(f"Generating weekly report for {start_date.date()} to {end_date.date()}")

            report = {
                "report_period": {
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "days": 7
                },
                "summary": self._get_summary_stats(db, start_date, end_date),
                "new_leads": self._get_new_leads_stats(db, start_date, end_date),
                "top_leads": self._get_top_leads(db, limit=10),
                "products": self._get_product_stats(db, start_date, end_date),
                "geographic": self._get_geographic_distribution(db),
                "source_breakdown": self._get_source_breakdown(db, start_date, end_date),
                "score_distribution": self._get_score_distribution(db),
                "trends": self._get_trends(db, start_date, end_date),
                "generated_at": datetime.utcnow().isoformat()
            }

            self.logger.info("Weekly report generated successfully")
            return report

        except Exception as e:
            self.logger.error(f"Error generating weekly report: {str(e)}", exc_info=True)
            raise

    def _get_summary_stats(
        self,
        db: Session,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Get high-level summary statistics"""
        # Total leads
        total_leads = db.query(Lead).count()

        # New leads this week
        new_leads_count = db.query(Lead).filter(
            Lead.scraped_at.between(start_date, end_date)
        ).count()

        # Average score
        avg_score = db.query(func.avg(Lead.potential_score)).scalar() or 0

        # Leads with websites
        leads_with_websites = db.query(Lead).filter(
            Lead.has_website == True
        ).count()

        # Total products
        total_products = db.query(LeadProduct).count()

        # Products added this week
        new_products_count = db.query(LeadProduct).filter(
            LeadProduct.scraped_at.between(start_date, end_date)
        ).count()

        return {
            "total_leads": total_leads,
            "new_leads_this_week": new_leads_count,
            "average_score": round(float(avg_score), 2),
            "leads_with_websites": leads_with_websites,
            "total_products": total_products,
            "new_products_this_week": new_products_count
        }

    def _get_new_leads_stats(
        self,
        db: Session,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Get statistics about new leads discovered this week"""
        new_leads = db.query(Lead).filter(
            Lead.scraped_at.between(start_date, end_date)
        ).all()

        if not new_leads:
            return {
                "count": 0,
                "average_score": 0,
                "with_websites": 0,
                "with_products": 0
            }

        # Calculate stats
        scores = [lead.potential_score for lead in new_leads if lead.potential_score]
        avg_score = sum(scores) / len(scores) if scores else 0

        with_websites = sum(1 for lead in new_leads if lead.has_website)

        # Count leads with products
        lead_ids = [lead.id for lead in new_leads]
        with_products = db.query(LeadProduct.lead_id).filter(
            LeadProduct.lead_id.in_(lead_ids)
        ).distinct().count()

        return {
            "count": len(new_leads),
            "average_score": round(avg_score, 2),
            "with_websites": with_websites,
            "with_products": with_products
        }

    def _get_top_leads(self, db: Session, limit: int = 10) -> List[Dict[str, Any]]:
        """Get top-scoring leads"""
        top_leads = db.query(Lead).filter(
            and_(
                Lead.potential_score.isnot(None),
                Lead.status.in_([LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUALIFIED])
            )
        ).order_by(
            desc(Lead.potential_score)
        ).limit(limit).all()

        result = []
        for lead in top_leads:
            # Count products
            product_count = db.query(LeadProduct).filter(
                LeadProduct.lead_id == lead.id
            ).count()

            result.append({
                "name": lead.business_name,
                "score": lead.potential_score,
                "city": lead.city,
                "phone": lead.phone,
                "website": lead.website_url,
                "products_count": product_count,
                "status": lead.status.value if lead.status else None,
                "source": lead.source.value if lead.source else None
            })

        return result

    def _get_product_stats(
        self,
        db: Session,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Get product scraping statistics"""
        # Total products
        total_products = db.query(LeadProduct).count()

        # New products this week
        new_products = db.query(LeadProduct).filter(
            LeadProduct.scraped_at.between(start_date, end_date)
        ).count()

        # Products with prices
        with_prices = db.query(LeadProduct).filter(
            LeadProduct.price.isnot(None)
        ).count()

        # Products with part numbers
        with_part_numbers = db.query(LeadProduct).filter(
            LeadProduct.part_number.isnot(None)
        ).count()

        # Average products per lead
        leads_with_products = db.query(LeadProduct.lead_id).distinct().count()
        avg_products_per_lead = total_products / leads_with_products if leads_with_products > 0 else 0

        return {
            "total": total_products,
            "new_this_week": new_products,
            "with_prices": with_prices,
            "with_part_numbers": with_part_numbers,
            "average_per_lead": round(avg_products_per_lead, 2)
        }

    def _get_geographic_distribution(self, db: Session) -> List[Dict[str, Any]]:
        """Get geographic distribution of leads"""
        city_stats = db.query(
            Lead.city,
            func.count(Lead.id).label("count"),
            func.avg(Lead.potential_score).label("avg_score")
        ).filter(
            Lead.city.isnot(None)
        ).group_by(Lead.city).order_by(
            desc(func.count(Lead.id))
        ).limit(10).all()

        return [
            {
                "city": city,
                "count": count,
                "average_score": round(float(avg_score or 0), 2)
            }
            for city, count, avg_score in city_stats
        ]

    def _get_source_breakdown(
        self,
        db: Session,
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict[str, Any]]:
        """Get breakdown of leads by source"""
        source_stats = db.query(
            Lead.source,
            func.count(Lead.id).label("total"),
            func.sum(
                func.case(
                    (Lead.scraped_at.between(start_date, end_date), 1),
                    else_=0
                )
            ).label("new_this_week")
        ).group_by(Lead.source).all()

        return [
            {
                "source": source.value if source else "Unknown",
                "total": total,
                "new_this_week": new_this_week or 0
            }
            for source, total, new_this_week in source_stats
        ]

    def _get_score_distribution(self, db: Session) -> Dict[str, int]:
        """Get distribution of leads by score ranges"""
        all_leads = db.query(Lead.potential_score).filter(
            Lead.potential_score.isnot(None)
        ).all()

        distribution = {
            "0-20": 0,
            "21-40": 0,
            "41-60": 0,
            "61-80": 0,
            "81-100": 0
        }

        for (score,) in all_leads:
            if score <= 20:
                distribution["0-20"] += 1
            elif score <= 40:
                distribution["21-40"] += 1
            elif score <= 60:
                distribution["41-60"] += 1
            elif score <= 80:
                distribution["61-80"] += 1
            else:
                distribution["81-100"] += 1

        return distribution

    def _get_trends(
        self,
        db: Session,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Get trend analysis compared to previous week"""
        # Previous week date range
        prev_start = start_date - timedelta(days=7)
        prev_end = start_date

        # Current week leads
        current_leads = db.query(Lead).filter(
            Lead.scraped_at.between(start_date, end_date)
        ).count()

        # Previous week leads
        previous_leads = db.query(Lead).filter(
            Lead.scraped_at.between(prev_start, prev_end)
        ).count()

        # Current week products
        current_products = db.query(LeadProduct).filter(
            LeadProduct.scraped_at.between(start_date, end_date)
        ).count()

        # Previous week products
        previous_products = db.query(LeadProduct).filter(
            LeadProduct.scraped_at.between(prev_start, prev_end)
        ).count()

        # Calculate percentage changes
        leads_change = self._calculate_percentage_change(previous_leads, current_leads)
        products_change = self._calculate_percentage_change(previous_products, current_products)

        return {
            "leads": {
                "current_week": current_leads,
                "previous_week": previous_leads,
                "change_percentage": leads_change
            },
            "products": {
                "current_week": current_products,
                "previous_week": previous_products,
                "change_percentage": products_change
            }
        }

    def _calculate_percentage_change(self, old_value: int, new_value: int) -> float:
        """Calculate percentage change between two values"""
        if old_value == 0:
            return 100.0 if new_value > 0 else 0.0

        change = ((new_value - old_value) / old_value) * 100
        return round(change, 2)

    def format_report_as_html(self, report: Dict[str, Any]) -> str:
        """
        Format report as HTML email

        Args:
            report: Report data dictionary

        Returns:
            HTML string
        """
        html = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }}
        h1 {{
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }}
        h2 {{
            color: #34495e;
            margin-top: 30px;
            border-left: 4px solid #3498db;
            padding-left: 10px;
        }}
        .summary-grid {{
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin: 20px 0;
        }}
        .stat-card {{
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #3498db;
        }}
        .stat-value {{
            font-size: 32px;
            font-weight: bold;
            color: #2c3e50;
        }}
        .stat-label {{
            color: #7f8c8d;
            font-size: 14px;
            margin-top: 5px;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }}
        th, td {{
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }}
        th {{
            background-color: #3498db;
            color: white;
        }}
        tr:hover {{
            background-color: #f5f5f5;
        }}
        .trend-up {{
            color: #27ae60;
        }}
        .trend-down {{
            color: #e74c3c;
        }}
        .footer {{
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #7f8c8d;
            font-size: 12px;
        }}
    </style>
</head>
<body>
    <h1>📊 Weekly Prospector Report</h1>
    <p><strong>Period:</strong> {report['report_period']['start_date'][:10]} to {report['report_period']['end_date'][:10]}</p>

    <h2>Summary</h2>
    <div class="summary-grid">
        <div class="stat-card">
            <div class="stat-value">{report['summary']['total_leads']}</div>
            <div class="stat-label">Total Leads</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">{report['summary']['new_leads_this_week']}</div>
            <div class="stat-label">New Leads This Week</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">{report['summary']['average_score']}</div>
            <div class="stat-label">Average Lead Score</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">{report['summary']['new_products_this_week']}</div>
            <div class="stat-label">New Products This Week</div>
        </div>
    </div>

    <h2>🏆 Top 10 Leads</h2>
    <table>
        <thead>
            <tr>
                <th>Business Name</th>
                <th>Score</th>
                <th>City</th>
                <th>Products</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
"""

        for lead in report['top_leads']:
            html += f"""
            <tr>
                <td><strong>{lead['name']}</strong></td>
                <td>{lead['score']}</td>
                <td>{lead['city'] or 'N/A'}</td>
                <td>{lead['products_count']}</td>
                <td>{lead['status']}</td>
            </tr>
"""

        html += """
        </tbody>
    </table>

    <h2>📈 Trends</h2>
    <p>
"""

        leads_trend = report['trends']['leads']
        products_trend = report['trends']['products']

        leads_class = "trend-up" if leads_trend['change_percentage'] > 0 else "trend-down"
        products_class = "trend-up" if products_trend['change_percentage'] > 0 else "trend-down"

        html += f"""
        <strong>Leads:</strong> {leads_trend['current_week']} this week vs {leads_trend['previous_week']} last week
        (<span class="{leads_class}">{leads_trend['change_percentage']:+.1f}%</span>)<br>
        <strong>Products:</strong> {products_trend['current_week']} this week vs {products_trend['previous_week']} last week
        (<span class="{products_class}">{products_trend['change_percentage']:+.1f}%</span>)
    </p>

    <h2>🌍 Geographic Distribution</h2>
    <table>
        <thead>
            <tr>
                <th>City</th>
                <th>Leads</th>
                <th>Avg Score</th>
            </tr>
        </thead>
        <tbody>
"""

        for city in report['geographic']:
            html += f"""
            <tr>
                <td>{city['city']}</td>
                <td>{city['count']}</td>
                <td>{city['average_score']}</td>
            </tr>
"""

        html += """
        </tbody>
    </table>

    <div class="footer">
        <p>This report was generated automatically by the Prospector Agent.</p>
        <p>Generated at: """ + report['generated_at'] + """</p>
    </div>
</body>
</html>
"""
        return html
