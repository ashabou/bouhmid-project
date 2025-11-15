"""
Lead SQLAlchemy Models
Matches the Prisma schema for Lead and LeadProduct tables
"""
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Text, JSON,
    ForeignKey, Enum as SQLEnum, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
import uuid
from .database import Base


class LeadStatus(str, enum.Enum):
    """Lead status enumeration"""
    NEW = "NEW"
    CONTACTED = "CONTACTED"
    QUALIFIED = "QUALIFIED"
    CONVERTED = "CONVERTED"
    REJECTED = "REJECTED"


class LeadSource(str, enum.Enum):
    """Lead source enumeration"""
    GOOGLE_MAPS = "GOOGLE_MAPS"
    SUPPLIER_WEBSITE = "SUPPLIER_WEBSITE"
    MARKETPLACE = "MARKETPLACE"
    MANUAL = "MANUAL"


class Lead(Base):
    """
    Lead model - Stores potential supplier information
    """
    __tablename__ = "leads"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Source information
    source = Column(SQLEnum(LeadSource), nullable=False, index=True)
    source_url = Column(String(1000), nullable=True)

    # Business information
    business_name = Column(String(500), nullable=False)
    contact_name = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True, index=True)
    country = Column(String(100), nullable=False, default="Tunisia")

    # Categorization
    lead_type = Column(String(50), nullable=True)

    # Scraped data
    products_found = Column(JSON, nullable=True)
    price_competitiveness_score = Column(Float, nullable=True)
    website_url = Column(String(500), nullable=True)
    has_website = Column(Boolean, default=False)

    # Scoring
    potential_score = Column(Integer, nullable=True, index=True)
    notes = Column(Text, nullable=True)

    # Status tracking
    status = Column(
        SQLEnum(LeadStatus),
        nullable=False,
        default=LeadStatus.NEW,
        index=True
    )
    contacted_at = Column(DateTime(timezone=True), nullable=True)
    qualified_at = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    scraped_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        index=True
    )
    last_updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        onupdate=func.now()
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now()
    )

    # Relationships
    lead_products = relationship(
        "LeadProduct",
        back_populates="lead",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Lead(id={self.id}, business_name='{self.business_name}', status={self.status})>"

    def to_dict(self):
        """Convert to dictionary"""
        return {
            "id": str(self.id),
            "source": self.source.value if self.source else None,
            "source_url": self.source_url,
            "business_name": self.business_name,
            "contact_name": self.contact_name,
            "phone": self.phone,
            "email": self.email,
            "address": self.address,
            "city": self.city,
            "country": self.country,
            "lead_type": self.lead_type,
            "products_found": self.products_found,
            "price_competitiveness_score": float(self.price_competitiveness_score) if self.price_competitiveness_score else None,
            "website_url": self.website_url,
            "has_website": self.has_website,
            "potential_score": self.potential_score,
            "notes": self.notes,
            "status": self.status.value if self.status else None,
            "contacted_at": self.contacted_at.isoformat() if self.contacted_at else None,
            "qualified_at": self.qualified_at.isoformat() if self.qualified_at else None,
            "scraped_at": self.scraped_at.isoformat() if self.scraped_at else None,
            "last_updated_at": self.last_updated_at.isoformat() if self.last_updated_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class LeadProduct(Base):
    """
    LeadProduct model - Stores products found during lead scraping
    """
    __tablename__ = "lead_products"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Foreign key
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True)

    # Product information
    name = Column(String(500), nullable=False)
    price = Column(Float, nullable=True)
    currency = Column(String(3), default="TND")
    part_number = Column(String(100), nullable=True)
    brand = Column(String(255), nullable=True)

    # Matching
    matched_product_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    price_difference = Column(Float, nullable=True)

    # Timestamp
    scraped_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now()
    )

    # Relationships
    lead = relationship("Lead", back_populates="lead_products")

    def __repr__(self):
        return f"<LeadProduct(id={self.id}, name='{self.name}', price={self.price})>"

    def to_dict(self):
        """Convert to dictionary"""
        return {
            "id": str(self.id),
            "lead_id": str(self.lead_id),
            "name": self.name,
            "price": float(self.price) if self.price else None,
            "currency": self.currency,
            "part_number": self.part_number,
            "brand": self.brand,
            "matched_product_id": str(self.matched_product_id) if self.matched_product_id else None,
            "price_difference": float(self.price_difference) if self.price_difference else None,
            "scraped_at": self.scraped_at.isoformat() if self.scraped_at else None,
        }
