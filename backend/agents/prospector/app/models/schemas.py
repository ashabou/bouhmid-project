"""
Pydantic schemas for request/response validation
"""
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List, Any
from datetime import datetime
from .lead import LeadStatus, LeadSource


class LeadProductBase(BaseModel):
    """Base schema for LeadProduct"""
    name: str
    price: Optional[float] = None
    currency: str = "TND"
    part_number: Optional[str] = None
    brand: Optional[str] = None


class LeadProductCreate(LeadProductBase):
    """Schema for creating a LeadProduct"""
    pass


class LeadProductResponse(LeadProductBase):
    """Schema for LeadProduct response"""
    id: str
    lead_id: str
    matched_product_id: Optional[str] = None
    price_difference: Optional[float] = None
    scraped_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LeadBase(BaseModel):
    """Base schema for Lead"""
    business_name: str = Field(..., min_length=1, max_length=500)
    contact_name: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    city: Optional[str] = Field(None, max_length=100)
    country: str = Field(default="Tunisia", max_length=100)
    lead_type: Optional[str] = Field(None, max_length=50)
    website_url: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = None


class LeadCreate(LeadBase):
    """Schema for creating a Lead"""
    source: LeadSource
    source_url: Optional[str] = Field(None, max_length=1000)
    products_found: Optional[Any] = None
    price_competitiveness_score: Optional[float] = Field(None, ge=0, le=1)
    has_website: bool = False
    potential_score: Optional[int] = Field(None, ge=0, le=100)


class LeadUpdate(BaseModel):
    """Schema for updating a Lead"""
    contact_name: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[EmailStr] = None
    notes: Optional[str] = None
    status: Optional[LeadStatus] = None


class LeadResponse(LeadBase):
    """Schema for Lead response"""
    id: str
    source: LeadSource
    source_url: Optional[str] = None
    products_found: Optional[Any] = None
    price_competitiveness_score: Optional[float] = None
    has_website: bool
    potential_score: Optional[int] = None
    status: LeadStatus
    contacted_at: Optional[datetime] = None
    qualified_at: Optional[datetime] = None
    scraped_at: datetime
    last_updated_at: datetime
    created_at: datetime
    lead_products: List[LeadProductResponse] = []

    model_config = ConfigDict(from_attributes=True)


class LeadListResponse(BaseModel):
    """Schema for paginated lead list response"""
    data: List[LeadResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class GooglePlacesScrapeRequest(BaseModel):
    """Schema for Google Places scraping request"""
    query: str = Field(..., min_length=1, description="Search query (e.g., 'auto parts supplier')")
    location: str = Field(..., min_length=1, description="Location (e.g., 'Tunis, Tunisia')")
    radius: int = Field(default=50000, ge=1000, le=50000, description="Search radius in meters")
    max_results: int = Field(default=20, ge=1, le=60, description="Maximum number of results")


class GooglePlacesScrapeResponse(BaseModel):
    """Schema for Google Places scraping response"""
    success: bool
    message: str
    leads_found: int
    task_id: Optional[str] = None


class LeadStatsResponse(BaseModel):
    """Schema for lead statistics response"""
    total: int
    by_status: List[dict]
    by_source: List[dict]
    top_cities: List[dict]
