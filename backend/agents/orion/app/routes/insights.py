"""
Insights API Routes

Endpoints for generating and managing forecast insights
"""
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import date, datetime
import logging

from ..models import get_db, ForecastInsight
from ..models.forecast_insight import InsightType, Severity
from ..forecasting import InsightsGenerator

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/insights", tags=["insights"])


def run_insights_generation(
    product_id: Optional[str],
    category_id: Optional[int],
    forecast_horizon_days: int,
    db: Session
):
    """
    Background task to generate insights

    Args:
        product_id: Product ID to analyze
        category_id: Category ID to analyze
        forecast_horizon_days: Forecast horizon
        db: Database session
    """
    try:
        insights_gen = InsightsGenerator()
        result = insights_gen.generate_insights(
            product_id=product_id,
            category_id=category_id,
            forecast_horizon_days=forecast_horizon_days,
            db=db
        )

        logger.info(f"Insights generation completed: {result}")

    except Exception as e:
        logger.error(f"Error in background insights generation: {str(e)}", exc_info=True)
    finally:
        db.close()


@router.get("")
async def list_insights(
    product_id: Optional[str] = None,
    severity: Optional[str] = None,
    insight_type: Optional[str] = None,
    unread_only: bool = False,
    active_only: bool = True,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """
    List insights with optional filters

    Args:
        product_id: Filter by product ID
        severity: Filter by severity (low, medium, high, critical)
        insight_type: Filter by insight type
        unread_only: Only show unread insights
        active_only: Only show currently active insights
        page: Page number
        page_size: Items per page
        db: Database session

    Returns:
        Paginated list of insights
    """
    try:
        # Build query
        query = db.query(ForecastInsight)

        # Apply filters
        if active_only:
            today = date.today()
            query = query.filter(
                ForecastInsight.valid_from <= today,
                ForecastInsight.valid_until >= today
            )

        if product_id:
            query = query.filter(ForecastInsight.product_id == product_id)

        if severity:
            try:
                severity_enum = Severity(severity.lower())
                query = query.filter(ForecastInsight.severity == severity_enum)
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid severity: {severity}. Must be one of: low, medium, high, critical"
                )

        if insight_type:
            try:
                type_enum = InsightType(insight_type.lower())
                query = query.filter(ForecastInsight.insight_type == type_enum)
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid insight_type: {insight_type}"
                )

        if unread_only:
            query = query.filter(ForecastInsight.is_read == False)

        # Get total count
        total = query.count()

        # Order by severity (desc) and creation date (desc)
        query = query.order_by(
            ForecastInsight.severity.desc(),
            ForecastInsight.created_at.desc()
        )

        # Pagination
        offset = (page - 1) * page_size
        insights = query.offset(offset).limit(page_size).all()

        return {
            "data": [insight.to_dict() for insight in insights],
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": (total + page_size - 1) // page_size
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing insights: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error listing insights: {str(e)}")


@router.get("/{insight_id}")
async def get_insight(
    insight_id: str,
    db: Session = Depends(get_db)
):
    """
    Get insight by ID

    Args:
        insight_id: Insight UUID
        db: Database session

    Returns:
        Insight details
    """
    try:
        insight = db.query(ForecastInsight).filter(
            ForecastInsight.id == insight_id
        ).first()

        if not insight:
            raise HTTPException(status_code=404, detail=f"Insight not found: {insight_id}")

        return {"data": insight.to_dict()}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting insight: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error getting insight: {str(e)}")


@router.post("/generate")
async def generate_insights(
    product_id: Optional[str] = None,
    category_id: Optional[int] = None,
    forecast_horizon_days: int = 30,
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db)
):
    """
    Generate insights for product or category

    Args:
        product_id: Product ID to analyze
        category_id: Category ID to analyze
        forecast_horizon_days: Forecast horizon to analyze
        background_tasks: Background task runner
        db: Database session

    Returns:
        Generation task status
    """
    try:
        if not product_id and not category_id:
            raise HTTPException(
                status_code=400,
                detail="Either product_id or category_id must be provided"
            )

        # Run in background
        background_tasks.add_task(
            run_insights_generation,
            product_id,
            category_id,
            forecast_horizon_days,
            db
        )

        return {
            "message": "Insights generation started",
            "product_id": product_id,
            "category_id": category_id,
            "forecast_horizon_days": forecast_horizon_days
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting insights generation: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error starting insights generation: {str(e)}"
        )


@router.patch("/{insight_id}/mark-read")
async def mark_insight_read(
    insight_id: str,
    db: Session = Depends(get_db)
):
    """
    Mark insight as read

    Args:
        insight_id: Insight UUID
        db: Database session

    Returns:
        Updated insight
    """
    try:
        insight = db.query(ForecastInsight).filter(
            ForecastInsight.id == insight_id
        ).first()

        if not insight:
            raise HTTPException(status_code=404, detail=f"Insight not found: {insight_id}")

        insight.mark_as_read()
        db.commit()

        return {"data": insight.to_dict()}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error marking insight as read: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error marking insight as read: {str(e)}"
        )


@router.patch("/{insight_id}/mark-actioned")
async def mark_insight_actioned(
    insight_id: str,
    db: Session = Depends(get_db)
):
    """
    Mark insight as actioned

    Args:
        insight_id: Insight UUID
        db: Database session

    Returns:
        Updated insight
    """
    try:
        insight = db.query(ForecastInsight).filter(
            ForecastInsight.id == insight_id
        ).first()

        if not insight:
            raise HTTPException(status_code=404, detail=f"Insight not found: {insight_id}")

        insight.mark_as_actioned()
        db.commit()

        return {"data": insight.to_dict()}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error marking insight as actioned: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error marking insight as actioned: {str(e)}"
        )


@router.get("/stats/summary")
async def get_insights_summary(
    db: Session = Depends(get_db)
):
    """
    Get insights summary statistics

    Args:
        db: Database session

    Returns:
        Insights summary by severity and type
    """
    try:
        today = date.today()

        # Active insights
        active_insights = db.query(ForecastInsight).filter(
            ForecastInsight.valid_from <= today,
            ForecastInsight.valid_until >= today
        ).all()

        # Count by severity
        severity_counts = {}
        for severity in Severity:
            severity_counts[severity.value] = sum(
                1 for i in active_insights if i.severity == severity
            )

        # Count by type
        type_counts = {}
        for insight_type in InsightType:
            type_counts[insight_type.value] = sum(
                1 for i in active_insights if i.insight_type == insight_type
            )

        # Unread count
        unread_count = sum(1 for i in active_insights if not i.is_read)

        # Critical unactioned
        critical_unactioned = sum(
            1 for i in active_insights
            if i.severity == Severity.CRITICAL and not i.is_actioned
        )

        return {
            "total_active": len(active_insights),
            "unread": unread_count,
            "critical_unactioned": critical_unactioned,
            "by_severity": severity_counts,
            "by_type": type_counts,
            "generated_at": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Error getting insights summary: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error getting insights summary: {str(e)}"
        )
