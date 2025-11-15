"""
Forecast Insight Model

Stores actionable insights generated from forecast analysis
"""
from sqlalchemy import Column, String, DateTime, Boolean, Date, Integer, Index, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import datetime
from enum import Enum as PyEnum
import uuid
from .database import Base


class InsightType(str, PyEnum):
    """Types of insights"""
    DEMAND_SPIKE = "demand_spike"  # Predicted spike in demand
    DEMAND_DROP = "demand_drop"  # Predicted drop in demand
    STOCKOUT_RISK = "stockout_risk"  # Risk of running out of stock
    OVERSTOCK_RISK = "overstock_risk"  # Risk of excess inventory
    SEASONAL_TREND = "seasonal_trend"  # Seasonal pattern detected
    CATEGORY_TREND = "category_trend"  # Category-wide trend
    REORDER_ALERT = "reorder_alert"  # Time to reorder
    SLOW_MOVER = "slow_mover"  # Product moving slowly
    FAST_MOVER = "fast_mover"  # Product moving quickly


class Severity(str, PyEnum):
    """Severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ForecastInsight(Base):
    """
    Forecast insights and recommendations

    Stores actionable insights derived from forecast analysis.
    These are business recommendations based on predicted demand.
    """
    __tablename__ = "forecast_insights"

    # Primary key
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default="gen_random_uuid()"
    )

    # Type and severity
    insight_type = Column(SQLEnum(InsightType), nullable=False, index=True)
    severity = Column(SQLEnum(Severity), nullable=False, index=True)

    # Target (what the insight is about)
    product_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    category_id = Column(Integer, nullable=True, index=True)

    # Content
    title = Column(String(255), nullable=False)
    description = Column(String, nullable=False)  # TEXT type
    recommendation = Column(String, nullable=True)  # TEXT type

    # Supporting data
    data = Column(JSONB, nullable=True)  # Additional data (charts, metrics, etc.)

    # Status
    is_read = Column(Boolean, nullable=False, default=False, index=True)
    is_actioned = Column(Boolean, nullable=False, default=False)
    actioned_at = Column(DateTime, nullable=True)

    # Validity period
    valid_from = Column(Date, nullable=False, index=True)
    valid_until = Column(Date, nullable=False)

    # Metadata
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    # Indexes
    __table_args__ = (
        Index("idx_insight_validity", valid_from, valid_until),
        Index("idx_insight_severity_read", severity, is_read),
        Index("idx_insight_type_severity", insight_type, severity),
    )

    def __repr__(self):
        return (
            f"<ForecastInsight(id={self.id}, "
            f"type={self.insight_type}, "
            f"severity={self.severity}, "
            f"title='{self.title}')>"
        )

    def to_dict(self):
        """Convert to dictionary"""
        return {
            "id": str(self.id),
            "insight_type": self.insight_type.value if self.insight_type else None,
            "severity": self.severity.value if self.severity else None,
            "product_id": str(self.product_id) if self.product_id else None,
            "category_id": self.category_id,
            "title": self.title,
            "description": self.description,
            "recommendation": self.recommendation,
            "data": self.data,
            "is_read": self.is_read,
            "is_actioned": self.is_actioned,
            "actioned_at": self.actioned_at.isoformat() if self.actioned_at else None,
            "valid_from": self.valid_from.isoformat() if self.valid_from else None,
            "valid_until": self.valid_until.isoformat() if self.valid_until else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def mark_as_read(self):
        """Mark insight as read"""
        self.is_read = True

    def mark_as_actioned(self):
        """Mark insight as actioned"""
        self.is_actioned = True
        self.actioned_at = datetime.utcnow()

    def is_valid(self) -> bool:
        """
        Check if insight is currently valid

        Returns:
            True if within validity period
        """
        now = datetime.utcnow().date()
        return self.valid_from <= now <= self.valid_until

    def days_until_invalid(self) -> int:
        """
        Calculate days until insight expires

        Returns:
            Number of days until invalid
        """
        now = datetime.utcnow().date()
        delta = (self.valid_until - now).days
        return max(0, delta)
