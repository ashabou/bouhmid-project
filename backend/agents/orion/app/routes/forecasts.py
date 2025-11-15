"""
Forecasting API Routes

Endpoints for generating and managing demand forecasts
"""
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date, datetime, timedelta
import logging

from ..models import get_db, Forecast
from ..models.schemas import (
    ForecastListResponse,
    ForecastResponse,
    GenerateForecastRequest,
    GenerateForecastResponse,
    ForecastUpdateActual,
    ForecastAccuracyReport
)
from ..forecasting import Forecaster

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/forecasts", tags=["forecasts"])


def run_forecast_generation(
    request: GenerateForecastRequest,
    db: Session
):
    """
    Background task to generate forecasts

    Args:
        request: Forecast generation request
        db: Database session
    """
    try:
        forecaster = Forecaster()
        result = forecaster.generate_forecast(
            product_id=request.product_id,
            sku=request.sku,
            category_id=request.category_id,
            forecast_horizon_days=request.forecast_horizon_days,
            model_name=request.model_name or "SARIMA",
            db=db
        )

        logger.info(f"Forecast generation completed: {result}")

    except Exception as e:
        logger.error(f"Error in background forecast: {str(e)}", exc_info=True)
    finally:
        db.close()


@router.get("", response_model=ForecastListResponse)
async def list_forecasts(
    product_id: Optional[str] = None,
    sku: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    model_name: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """
    List forecasts with optional filters

    Args:
        product_id: Filter by product ID
        sku: Filter by SKU
        start_date: Filter by start date (YYYY-MM-DD)
        end_date: Filter by end date (YYYY-MM-DD)
        model_name: Filter by model name
        page: Page number
        page_size: Items per page
        db: Database session

    Returns:
        Paginated list of forecasts
    """
    try:
        # Build query
        query = db.query(Forecast)

        # Apply filters
        if product_id:
            query = query.filter(Forecast.product_id == product_id)
        if sku:
            query = query.filter(Forecast.sku == sku)
        if start_date:
            query = query.filter(Forecast.forecast_date >= start_date)
        if end_date:
            query = query.filter(Forecast.forecast_date <= end_date)
        if model_name:
            query = query.filter(Forecast.model_name == model_name)

        # Get total count
        total = query.count()

        # Apply pagination
        skip = (page - 1) * page_size
        forecasts = query.order_by(
            Forecast.forecast_date.asc()
        ).offset(skip).limit(page_size).all()

        # Calculate total pages
        total_pages = (total + page_size - 1) // page_size

        return ForecastListResponse(
            data=[ForecastResponse.model_validate(f) for f in forecasts],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )

    except Exception as e:
        logger.error(f"Error listing forecasts: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate", response_model=GenerateForecastResponse)
async def generate_forecast(
    request: GenerateForecastRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Generate forecast (async)

    Queues forecast generation as background task

    Args:
        request: Forecast generation request
        background_tasks: FastAPI background tasks
        db: Database session

    Returns:
        Task info
    """
    try:
        # Validate that at least one identifier is provided
        if not request.product_id and not request.sku and not request.category_id:
            raise HTTPException(
                status_code=400,
                detail="Must provide at least one of: product_id, sku, category_id"
            )

        # Queue background task
        background_tasks.add_task(
            run_forecast_generation,
            request=request,
            db=db
        )

        logger.info(f"Forecast generation task queued for {request}")

        return GenerateForecastResponse(
            success=True,
            message="Forecast generation started",
            forecasts_created=0,  # Will be updated when task completes
            products_processed=1
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting forecast generation: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate/sync", response_model=GenerateForecastResponse)
async def generate_forecast_sync(
    request: GenerateForecastRequest,
    db: Session = Depends(get_db)
):
    """
    Generate forecast (synchronous)

    Generates forecast immediately and waits for completion.
    Use async endpoint for better performance.

    Args:
        request: Forecast generation request
        db: Database session

    Returns:
        Forecast generation results
    """
    try:
        # Validate
        if not request.product_id and not request.sku and not request.category_id:
            raise HTTPException(
                status_code=400,
                detail="Must provide at least one of: product_id, sku, category_id"
            )

        # Generate forecast
        forecaster = Forecaster()
        result = forecaster.generate_forecast(
            product_id=request.product_id,
            sku=request.sku,
            category_id=request.category_id,
            forecast_horizon_days=request.forecast_horizon_days,
            model_name=request.model_name or "SARIMA",
            db=db
        )

        if result['success']:
            return GenerateForecastResponse(
                success=True,
                message=f"Generated {result['forecasts_created']} forecasts",
                forecasts_created=result['forecasts_created'],
                products_processed=1
            )
        else:
            raise HTTPException(status_code=400, detail=result.get('error', 'Forecast generation failed'))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating forecast: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{forecast_id}", response_model=ForecastResponse)
async def get_forecast(forecast_id: str, db: Session = Depends(get_db)):
    """
    Get a specific forecast by ID

    Args:
        forecast_id: Forecast UUID
        db: Database session

    Returns:
        Forecast details
    """
    try:
        forecast = db.query(Forecast).filter(Forecast.id == forecast_id).first()
        if not forecast:
            raise HTTPException(status_code=404, detail="Forecast not found")

        return ForecastResponse.model_validate(forecast)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting forecast {forecast_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{forecast_id}/actual", response_model=ForecastResponse)
async def update_forecast_actual(
    forecast_id: str,
    update: ForecastUpdateActual,
    db: Session = Depends(get_db)
):
    """
    Update forecast with actual value

    Used for model evaluation after forecast date has passed

    Args:
        forecast_id: Forecast UUID
        update: Actual quantity update
        db: Database session

    Returns:
        Updated forecast
    """
    try:
        forecast = db.query(Forecast).filter(Forecast.id == forecast_id).first()
        if not forecast:
            raise HTTPException(status_code=404, detail="Forecast not found")

        # Update actual quantity
        forecast.actual_quantity = update.actual_quantity

        # Calculate error
        forecast.calculate_error()

        db.commit()
        db.refresh(forecast)

        logger.info(f"Updated forecast {forecast_id} with actual: {update.actual_quantity}")
        return ForecastResponse.model_validate(forecast)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating forecast {forecast_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update-actuals")
async def update_all_actuals(
    target_date: Optional[str] = Query(None, description="Date to update (YYYY-MM-DD), defaults to yesterday"),
    db: Session = Depends(get_db)
):
    """
    Update all forecasts with actual values for a date

    Args:
        target_date: Date to update (defaults to yesterday)
        db: Database session

    Returns:
        Update summary
    """
    try:
        # Default to yesterday if no date provided
        if target_date:
            update_date = datetime.strptime(target_date, '%Y-%m-%d').date()
        else:
            update_date = (datetime.utcnow() - timedelta(days=1)).date()

        forecaster = Forecaster()
        result = forecaster.update_forecast_actuals(
            forecast_date=update_date,
            db=db
        )

        return result

    except Exception as e:
        logger.error(f"Error updating actuals: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/accuracy/report", response_model=ForecastAccuracyReport)
async def get_accuracy_report(
    start_date: str = Query(..., description="Report start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="Report end date (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """
    Get forecast accuracy report

    Evaluates forecast performance for a date range

    Args:
        start_date: Report start date
        end_date: Report end date
        db: Database session

    Returns:
        Accuracy report with metrics by model
    """
    try:
        start = datetime.strptime(start_date, '%Y-%m-%d').date()
        end = datetime.strptime(end_date, '%Y-%m-%d').date()

        forecaster = Forecaster()
        report = forecaster.get_accuracy_report(
            start_date=start,
            end_date=end,
            db=db
        )

        if report['success']:
            return ForecastAccuracyReport(**report)
        else:
            raise HTTPException(status_code=400, detail=report.get('error', 'Report generation failed'))

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating accuracy report: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
