"""
Pydantic schemas for request/response validation
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from decimal import Decimal
from enum import Enum


# Enums
class InsightTypeSchema(str, Enum):
    """Insight types"""
    DEMAND_SPIKE = "demand_spike"
    DEMAND_DROP = "demand_drop"
    STOCKOUT_RISK = "stockout_risk"
    OVERSTOCK_RISK = "overstock_risk"
    SEASONAL_TREND = "seasonal_trend"
    CATEGORY_TREND = "category_trend"
    REORDER_ALERT = "reorder_alert"
    SLOW_MOVER = "slow_mover"
    FAST_MOVER = "fast_mover"


class SeveritySchema(str, Enum):
    """Severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# ============================================
# Sales History Schemas
# ============================================

class SalesHistoryBase(BaseModel):
    """Base schema for sales history"""
    sale_date: date
    product_id: Optional[str] = None
    sku: Optional[str] = None
    product_name: Optional[str] = None
    quantity_sold: int = Field(..., gt=0, description="Quantity sold must be positive")
    unit_price: Decimal = Field(..., gt=0, description="Unit price must be positive")
    total_revenue: Decimal = Field(..., gt=0, description="Total revenue must be positive")
    brand_id: Optional[int] = None
    category_id: Optional[int] = None
    customer_type: Optional[str] = None


class SalesHistoryCreate(SalesHistoryBase):
    """Schema for creating sales history"""
    pass


class SalesHistoryResponse(SalesHistoryBase):
    """Schema for sales history response"""
    id: int
    imported_from: str
    created_at: datetime

    class Config:
        from_attributes = True


class SalesHistoryListResponse(BaseModel):
    """Paginated list of sales history"""
    data: List[SalesHistoryResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ============================================
# Forecast Schemas
# ============================================

class ForecastBase(BaseModel):
    """Base schema for forecast"""
    product_id: str
    sku: str
    forecast_date: date
    forecast_horizon: Optional[str] = None
    predicted_quantity: Decimal = Field(..., ge=0)
    confidence_interval_lower: Optional[Decimal] = None
    confidence_interval_upper: Optional[Decimal] = None
    confidence_score: Optional[Decimal] = Field(None, ge=0, le=1)
    model_name: Optional[str] = None
    model_version: Optional[str] = None
    features_used: Optional[Dict[str, Any]] = None


class ForecastCreate(ForecastBase):
    """Schema for creating forecast"""
    pass


class ForecastResponse(ForecastBase):
    """Schema for forecast response"""
    id: str
    actual_quantity: Optional[Decimal] = None
    error: Optional[Decimal] = None
    generated_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class ForecastListResponse(BaseModel):
    """Paginated list of forecasts"""
    data: List[ForecastResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class ForecastUpdateActual(BaseModel):
    """Schema for updating forecast with actual values"""
    actual_quantity: Decimal = Field(..., ge=0)


# ============================================
# Forecast Insight Schemas
# ============================================

class ForecastInsightBase(BaseModel):
    """Base schema for forecast insight"""
    insight_type: InsightTypeSchema
    severity: SeveritySchema
    product_id: Optional[str] = None
    category_id: Optional[int] = None
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    recommendation: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    valid_from: date
    valid_until: date

    @field_validator("valid_until")
    @classmethod
    def validate_dates(cls, v, info):
        """Ensure valid_until is after valid_from"""
        if "valid_from" in info.data and v < info.data["valid_from"]:
            raise ValueError("valid_until must be after valid_from")
        return v


class ForecastInsightCreate(ForecastInsightBase):
    """Schema for creating forecast insight"""
    pass


class ForecastInsightResponse(ForecastInsightBase):
    """Schema for forecast insight response"""
    id: str
    is_read: bool
    is_actioned: bool
    actioned_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ForecastInsightUpdate(BaseModel):
    """Schema for updating forecast insight"""
    is_read: Optional[bool] = None
    is_actioned: Optional[bool] = None


class ForecastInsightListResponse(BaseModel):
    """Paginated list of forecast insights"""
    data: List[ForecastInsightResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ============================================
# Forecasting Request/Response Schemas
# ============================================

class GenerateForecastRequest(BaseModel):
    """Request to generate forecast"""
    product_id: Optional[str] = None
    sku: Optional[str] = None
    category_id: Optional[int] = None
    forecast_horizon_days: int = Field(30, ge=1, le=365, description="Forecast horizon in days")
    model_name: Optional[str] = Field(None, description="Specific model to use (SARIMA, Prophet, Ensemble)")

    @field_validator("model_name")
    @classmethod
    def validate_model(cls, v):
        """Validate model name"""
        if v and v not in ["SARIMA", "Prophet", "Ensemble"]:
            raise ValueError("model_name must be one of: SARIMA, Prophet, Ensemble")
        return v


class GenerateForecastResponse(BaseModel):
    """Response from forecast generation"""
    success: bool
    message: str
    forecasts_created: int
    products_processed: int
    task_id: Optional[str] = None


class CSVImportRequest(BaseModel):
    """Request for CSV import"""
    file_path: str
    validate_only: bool = Field(False, description="Only validate, don't import")
    skip_duplicates: bool = Field(True, description="Skip duplicate entries")


class CSVImportResponse(BaseModel):
    """Response from CSV import"""
    success: bool
    message: str
    records_imported: int
    records_skipped: int
    records_failed: int
    errors: Optional[List[str]] = None


class ModelPerformanceMetrics(BaseModel):
    """Model performance metrics"""
    model_name: str
    mae: float  # Mean Absolute Error
    mape: float  # Mean Absolute Percentage Error
    rmse: float  # Root Mean Squared Error
    r2_score: float  # R-squared
    samples_evaluated: int
    last_updated: datetime


class ForecastAccuracyReport(BaseModel):
    """Forecast accuracy report"""
    period_start: date
    period_end: date
    models: List[ModelPerformanceMetrics]
    overall_mape: float
    total_forecasts: int
    forecasts_with_actuals: int
