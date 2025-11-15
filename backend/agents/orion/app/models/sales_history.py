"""
Sales History Model

Stores historical sales data for forecasting models
"""
from sqlalchemy import Column, Integer, String, DateTime, Decimal, Date, Index
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
from .database import Base


class SalesHistory(Base):
    """
    Sales history records

    Stores historical sales transactions for training forecasting models.
    Each record represents a single sales transaction.
    """
    __tablename__ = "sales_history"

    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True)

    # Transaction details
    sale_date = Column(Date, nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    sku = Column(String(100), nullable=True, index=True)
    product_name = Column(String(500), nullable=True)

    # Quantity and revenue
    quantity_sold = Column(Integer, nullable=False)
    unit_price = Column(Decimal(10, 2), nullable=False)
    total_revenue = Column(Decimal(10, 2), nullable=False)

    # Context (foreign keys reference main database)
    brand_id = Column(Integer, nullable=True, index=True)
    category_id = Column(Integer, nullable=True, index=True)
    customer_type = Column(String(50), nullable=True)

    # Metadata
    imported_from = Column(String(50), nullable=False, default="csv")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    # Indexes for performance
    __table_args__ = (
        Index("idx_sales_date_desc", sale_date.desc()),
        Index("idx_sales_product_date", product_id, sale_date),
        Index("idx_sales_sku_date", sku, sale_date),
        Index("idx_sales_category_date", category_id, sale_date),
        Index("idx_sales_brand_date", brand_id, sale_date),
    )

    def __repr__(self):
        return (
            f"<SalesHistory(id={self.id}, "
            f"sale_date={self.sale_date}, "
            f"sku={self.sku}, "
            f"quantity={self.quantity_sold})>"
        )

    def to_dict(self):
        """Convert to dictionary"""
        return {
            "id": self.id,
            "sale_date": self.sale_date.isoformat() if self.sale_date else None,
            "product_id": str(self.product_id) if self.product_id else None,
            "sku": self.sku,
            "product_name": self.product_name,
            "quantity_sold": self.quantity_sold,
            "unit_price": float(self.unit_price) if self.unit_price else None,
            "total_revenue": float(self.total_revenue) if self.total_revenue else None,
            "brand_id": self.brand_id,
            "category_id": self.category_id,
            "customer_type": self.customer_type,
            "imported_from": self.imported_from,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
