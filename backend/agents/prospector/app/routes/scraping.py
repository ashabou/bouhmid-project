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
