"""
Lead management API routes
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
import logging

from ..models import Lead, LeadStatus, LeadSource, get_db
from ..models.schemas import (
    LeadResponse,
    LeadListResponse,
    LeadUpdate,
    LeadStatsResponse
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/leads", tags=["leads"])


@router.get("", response_model=LeadListResponse)
async def list_leads(
    status: Optional[LeadStatus] = None,
    source: Optional[LeadSource] = None,
    city: Optional[str] = None,
    min_score: Optional[int] = Query(None, ge=0, le=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    List leads with optional filters

    Args:
        status: Filter by lead status
        source: Filter by lead source
        city: Filter by city (partial match)
        min_score: Minimum potential score
        page: Page number (starts at 1)
        page_size: Items per page (max 100)
        db: Database session

    Returns:
        Paginated list of leads
    """
    try:
        # Build query
        query = db.query(Lead)

        # Apply filters
        if status:
            query = query.filter(Lead.status == status)
        if source:
            query = query.filter(Lead.source == source)
        if city:
            query = query.filter(Lead.city.ilike(f"%{city}%"))
        if min_score is not None:
            query = query.filter(Lead.potential_score >= min_score)

        # Get total count
        total = query.count()

        # Apply pagination
        skip = (page - 1) * page_size
        leads = query.order_by(
            Lead.potential_score.desc(),
            Lead.scraped_at.desc()
        ).offset(skip).limit(page_size).all()

        # Calculate total pages
        total_pages = (total + page_size - 1) // page_size

        return LeadListResponse(
            data=[LeadResponse.model_validate(lead) for lead in leads],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )

    except Exception as e:
        logger.error(f"Error listing leads: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats", response_model=LeadStatsResponse)
async def get_lead_stats(db: Session = Depends(get_db)):
    """
    Get lead statistics

    Returns:
        Statistics about leads
    """
    try:
        total = db.query(Lead).count()

        # By status
        status_stats = db.query(
            Lead.status,
            db.func.count(Lead.id)
        ).group_by(Lead.status).all()

        by_status = [
            {"status": str(status), "count": count}
            for status, count in status_stats
        ]

        # By source
        source_stats = db.query(
            Lead.source,
            db.func.count(Lead.id)
        ).group_by(Lead.source).all()

        by_source = [
            {"source": str(source), "count": count}
            for source, count in source_stats
        ]

        # Top cities
        city_stats = db.query(
            Lead.city,
            db.func.count(Lead.id)
        ).filter(
            Lead.city.isnot(None)
        ).group_by(Lead.city).order_by(
            db.func.count(Lead.id).desc()
        ).limit(10).all()

        top_cities = [
            {"city": city, "count": count}
            for city, count in city_stats
        ]

        return LeadStatsResponse(
            total=total,
            by_status=by_status,
            by_source=by_source,
            top_cities=top_cities
        )

    except Exception as e:
        logger.error(f"Error getting lead stats: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{lead_id}", response_model=LeadResponse)
async def get_lead(lead_id: str, db: Session = Depends(get_db)):
    """
    Get a specific lead by ID

    Args:
        lead_id: Lead UUID
        db: Database session

    Returns:
        Lead details
    """
    try:
        lead = db.query(Lead).filter(Lead.id == lead_id).first()
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")

        return LeadResponse.model_validate(lead)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting lead {lead_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{lead_id}", response_model=LeadResponse)
async def update_lead(
    lead_id: str,
    lead_update: LeadUpdate,
    db: Session = Depends(get_db)
):
    """
    Update a lead

    Args:
        lead_id: Lead UUID
        lead_update: Fields to update
        db: Database session

    Returns:
        Updated lead
    """
    try:
        lead = db.query(Lead).filter(Lead.id == lead_id).first()
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")

        # Update fields
        update_data = lead_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(lead, field, value)

        db.commit()
        db.refresh(lead)

        logger.info(f"Updated lead {lead_id}: {update_data}")
        return LeadResponse.model_validate(lead)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating lead {lead_id}: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{lead_id}")
async def delete_lead(lead_id: str, db: Session = Depends(get_db)):
    """
    Delete a lead

    Args:
        lead_id: Lead UUID
        db: Database session

    Returns:
        Success message
    """
    try:
        lead = db.query(Lead).filter(Lead.id == lead_id).first()
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")

        db.delete(lead)
        db.commit()

        logger.info(f"Deleted lead {lead_id}")
        return {"success": True, "message": "Lead deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting lead {lead_id}: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
