"""
Sales History API Routes

Endpoints for managing sales history data and CSV imports
"""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional
import logging
import tempfile
import os

from ..models import get_db, SalesHistory
from ..models.schemas import (
    SalesHistoryListResponse,
    SalesHistoryResponse,
    CSVImportRequest,
    CSVImportResponse
)
from ..data import CSVImporter, CSVImportError, DataValidator

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/sales-history", tags=["sales_history"])


@router.get("", response_model=SalesHistoryListResponse)
async def list_sales_history(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    product_id: Optional[str] = None,
    sku: Optional[str] = None,
    category_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """
    List sales history records with optional filters

    Args:
        start_date: Filter by start date (YYYY-MM-DD)
        end_date: Filter by end date (YYYY-MM-DD)
        product_id: Filter by product ID
        sku: Filter by SKU
        category_id: Filter by category ID
        page: Page number
        page_size: Items per page
        db: Database session

    Returns:
        Paginated list of sales history records
    """
    try:
        # Build query
        query = db.query(SalesHistory)

        # Apply filters
        if start_date:
            query = query.filter(SalesHistory.sale_date >= start_date)
        if end_date:
            query = query.filter(SalesHistory.sale_date <= end_date)
        if product_id:
            query = query.filter(SalesHistory.product_id == product_id)
        if sku:
            query = query.filter(SalesHistory.sku == sku)
        if category_id:
            query = query.filter(SalesHistory.category_id == category_id)

        # Get total count
        total = query.count()

        # Apply pagination
        skip = (page - 1) * page_size
        records = query.order_by(
            SalesHistory.sale_date.desc()
        ).offset(skip).limit(page_size).all()

        # Calculate total pages
        total_pages = (total + page_size - 1) // page_size

        return SalesHistoryListResponse(
            data=[SalesHistoryResponse.model_validate(record) for record in records],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )

    except Exception as e:
        logger.error(f"Error listing sales history: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/import/upload", response_model=CSVImportResponse)
async def upload_csv(
    file: UploadFile = File(...),
    validate_only: bool = Query(False, description="Only validate, don't import"),
    skip_duplicates: bool = Query(True, description="Skip duplicate entries"),
    db: Session = Depends(get_db)
):
    """
    Upload and import CSV file

    Args:
        file: CSV file to upload
        validate_only: Only validate, don't import
        skip_duplicates: Skip duplicate entries
        db: Database session

    Returns:
        Import result
    """
    try:
        # Validate file type
        if not file.filename.endswith('.csv'):
            raise HTTPException(
                status_code=400,
                detail="Invalid file type. Only CSV files are supported."
            )

        # Save uploaded file to temporary location
        with tempfile.NamedTemporaryFile(delete=False, suffix='.csv', mode='wb') as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name

        try:
            # Import CSV
            importer = CSVImporter()
            result = importer.import_csv(
                file_path=tmp_path,
                db=db,
                validate_only=validate_only,
                skip_duplicates=skip_duplicates
            )

            return CSVImportResponse(**result)

        finally:
            # Clean up temporary file
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    except CSVImportError as e:
        logger.error(f"CSV import error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error importing CSV: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/import/file", response_model=CSVImportResponse)
async def import_csv_file(
    request: CSVImportRequest,
    db: Session = Depends(get_db)
):
    """
    Import CSV file from server path

    Args:
        request: Import request with file path
        db: Database session

    Returns:
        Import result
    """
    try:
        importer = CSVImporter()
        result = importer.import_csv(
            file_path=request.file_path,
            db=db,
            validate_only=request.validate_only,
            skip_duplicates=request.skip_duplicates
        )

        return CSVImportResponse(**result)

    except CSVImportError as e:
        logger.error(f"CSV import error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error importing CSV: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/validate")
async def validate_data_quality(db: Session = Depends(get_db)):
    """
    Validate sales history data quality

    Returns comprehensive data quality report including:
    - Minimum data requirements
    - Data completeness
    - Time series gaps
    - Outliers
    - Product coverage

    Args:
        db: Database session

    Returns:
        Data quality report
    """
    try:
        validator = DataValidator()
        report = validator.validate_data_quality(db)
        return report

    except Exception as e:
        logger.error(f"Error validating data quality: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary")
async def get_data_summary(db: Session = Depends(get_db)):
    """
    Get sales history data summary

    Returns aggregate statistics and summaries

    Args:
        db: Database session

    Returns:
        Data summary
    """
    try:
        validator = DataValidator()
        summary = validator.get_data_summary(db)
        return summary

    except Exception as e:
        logger.error(f"Error getting data summary: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/clear")
async def clear_sales_history(
    confirm: bool = Query(False, description="Confirm deletion"),
    db: Session = Depends(get_db)
):
    """
    Clear all sales history data

    WARNING: This deletes ALL sales history records permanently.

    Args:
        confirm: Must be true to confirm deletion
        db: Database session

    Returns:
        Deletion result
    """
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="Must confirm deletion by setting confirm=true"
        )

    try:
        count = db.query(SalesHistory).count()
        db.query(SalesHistory).delete()
        db.commit()

        logger.warning(f"Deleted {count} sales history records")

        return {
            "success": True,
            "message": f"Deleted {count} sales history records",
            "records_deleted": count
        }

    except Exception as e:
        db.rollback()
        logger.error(f"Error clearing sales history: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
