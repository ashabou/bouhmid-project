"""
Data Validation and Quality Checks

Validates sales history data quality and provides data quality metrics
"""
import logging
from typing import Dict, Any, List
from datetime import datetime, timedelta, date
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models.sales_history import SalesHistory
from ..config import settings

logger = logging.getLogger(__name__)


class DataValidator:
    """
    Validates sales history data quality

    Checks for:
    - Sufficient historical data
    - Data completeness
    - Outliers and anomalies
    - Gaps in time series
    """

    def __init__(self):
        """Initialize data validator"""
        self.logger = logger

    def validate_data_quality(self, db: Session) -> Dict[str, Any]:
        """
        Comprehensive data quality validation

        Args:
            db: Database session

        Returns:
            Data quality report
        """
        self.logger.info("Running data quality validation")

        report = {
            "timestamp": datetime.utcnow().isoformat(),
            "checks": {},
            "warnings": [],
            "errors": [],
            "overall_status": "pass"
        }

        # Check 1: Minimum data requirements
        min_data_check = self._check_minimum_data(db)
        report["checks"]["minimum_data"] = min_data_check
        if not min_data_check["passed"]:
            report["errors"].append(min_data_check["message"])
            report["overall_status"] = "fail"

        # Check 2: Data completeness
        completeness_check = self._check_data_completeness(db)
        report["checks"]["completeness"] = completeness_check
        if completeness_check["missing_fields_pct"] > 20:
            report["warnings"].append(
                f"High percentage of missing fields: {completeness_check['missing_fields_pct']:.1f}%"
            )

        # Check 3: Time series gaps
        gaps_check = self._check_time_series_gaps(db)
        report["checks"]["time_series_gaps"] = gaps_check
        if gaps_check["large_gaps"] > 0:
            report["warnings"].append(
                f"Found {gaps_check['large_gaps']} large gaps in time series (>30 days)"
            )

        # Check 4: Outliers
        outliers_check = self._check_outliers(db)
        report["checks"]["outliers"] = outliers_check
        if outliers_check["outlier_pct"] > 5:
            report["warnings"].append(
                f"High percentage of outliers: {outliers_check['outlier_pct']:.1f}%"
            )

        # Check 5: Product coverage
        product_check = self._check_product_coverage(db)
        report["checks"]["product_coverage"] = product_check

        # Set overall status based on errors
        if report["errors"]:
            report["overall_status"] = "fail"
        elif report["warnings"]:
            report["overall_status"] = "warning"

        self.logger.info(f"Data quality validation complete: {report['overall_status']}")
        return report

    def _check_minimum_data(self, db: Session) -> Dict[str, Any]:
        """
        Check if there's sufficient data for forecasting

        Requires at least MIN_HISTORY_DAYS of data
        """
        # Get date range
        date_range = db.query(
            func.min(SalesHistory.sale_date).label('min_date'),
            func.max(SalesHistory.sale_date).label('max_date'),
            func.count(SalesHistory.id).label('total_records')
        ).first()

        if not date_range or not date_range.min_date:
            return {
                "passed": False,
                "message": "No sales history data found",
                "days_of_data": 0,
                "required_days": settings.MIN_HISTORY_DAYS
            }

        min_date = date_range.min_date
        max_date = date_range.max_date
        days_of_data = (max_date - min_date).days

        passed = days_of_data >= settings.MIN_HISTORY_DAYS

        return {
            "passed": passed,
            "message": f"{'Sufficient' if passed else 'Insufficient'} historical data",
            "days_of_data": days_of_data,
            "required_days": settings.MIN_HISTORY_DAYS,
            "total_records": date_range.total_records,
            "date_range": {
                "start": min_date.isoformat(),
                "end": max_date.isoformat()
            }
        }

    def _check_data_completeness(self, db: Session) -> Dict[str, Any]:
        """
        Check data completeness (missing fields)
        """
        total_records = db.query(SalesHistory).count()

        if total_records == 0:
            return {
                "total_records": 0,
                "missing_fields_pct": 0,
                "field_completeness": {}
            }

        # Check completeness of optional fields
        field_stats = {}
        optional_fields = ['product_id', 'sku', 'product_name', 'brand_id', 'category_id']

        for field in optional_fields:
            null_count = db.query(SalesHistory).filter(
                getattr(SalesHistory, field).is_(None)
            ).count()
            completeness_pct = ((total_records - null_count) / total_records) * 100
            field_stats[field] = {
                "completeness_pct": round(completeness_pct, 2),
                "null_count": null_count
            }

        # Calculate average completeness
        avg_completeness = sum(
            stats["completeness_pct"] for stats in field_stats.values()
        ) / len(field_stats)

        return {
            "total_records": total_records,
            "average_completeness_pct": round(avg_completeness, 2),
            "missing_fields_pct": round(100 - avg_completeness, 2),
            "field_completeness": field_stats
        }

    def _check_time_series_gaps(self, db: Session) -> Dict[str, Any]:
        """
        Check for gaps in time series data

        Looks for periods with no sales data
        """
        # Get all unique sale dates, ordered
        sale_dates = db.query(
            SalesHistory.sale_date
        ).distinct().order_by(
            SalesHistory.sale_date
        ).all()

        if len(sale_dates) < 2:
            return {
                "total_gaps": 0,
                "large_gaps": 0,
                "max_gap_days": 0
            }

        # Calculate gaps between consecutive dates
        gaps = []
        large_gaps = 0  # Gaps > 30 days

        for i in range(len(sale_dates) - 1):
            current_date = sale_dates[i][0]
            next_date = sale_dates[i + 1][0]
            gap_days = (next_date - current_date).days - 1  # -1 because consecutive days have gap of 0

            if gap_days > 0:
                gaps.append(gap_days)
                if gap_days > 30:
                    large_gaps += 1

        return {
            "total_gaps": len(gaps),
            "large_gaps": large_gaps,
            "max_gap_days": max(gaps) if gaps else 0,
            "average_gap_days": round(sum(gaps) / len(gaps), 2) if gaps else 0
        }

    def _check_outliers(self, db: Session) -> Dict[str, Any]:
        """
        Check for outliers in quantity and price

        Uses IQR method to detect outliers
        """
        # Get quantity statistics
        qty_stats = db.query(
            func.avg(SalesHistory.quantity_sold).label('mean'),
            func.percentile_cont(0.25).within_group(SalesHistory.quantity_sold).label('q1'),
            func.percentile_cont(0.75).within_group(SalesHistory.quantity_sold).label('q3')
        ).first()

        if not qty_stats or not qty_stats.q1:
            return {
                "outlier_count": 0,
                "outlier_pct": 0,
                "total_records": 0
            }

        # Calculate IQR and bounds
        iqr = float(qty_stats.q3) - float(qty_stats.q1)
        lower_bound = float(qty_stats.q1) - (1.5 * iqr)
        upper_bound = float(qty_stats.q3) + (1.5 * iqr)

        # Count outliers
        total_records = db.query(SalesHistory).count()
        outlier_count = db.query(SalesHistory).filter(
            (SalesHistory.quantity_sold < lower_bound) |
            (SalesHistory.quantity_sold > upper_bound)
        ).count()

        outlier_pct = (outlier_count / total_records * 100) if total_records > 0 else 0

        return {
            "outlier_count": outlier_count,
            "outlier_pct": round(outlier_pct, 2),
            "total_records": total_records,
            "bounds": {
                "lower": round(lower_bound, 2),
                "upper": round(upper_bound, 2)
            },
            "statistics": {
                "q1": float(qty_stats.q1),
                "q3": float(qty_stats.q3),
                "iqr": iqr
            }
        }

    def _check_product_coverage(self, db: Session) -> Dict[str, Any]:
        """
        Check product coverage in sales history
        """
        total_records = db.query(SalesHistory).count()

        # Count unique products
        unique_product_ids = db.query(SalesHistory.product_id).filter(
            SalesHistory.product_id.isnot(None)
        ).distinct().count()

        unique_skus = db.query(SalesHistory.sku).filter(
            SalesHistory.sku.isnot(None)
        ).distinct().count()

        # Records with product identification
        with_product_id = db.query(SalesHistory).filter(
            SalesHistory.product_id.isnot(None)
        ).count()

        with_sku = db.query(SalesHistory).filter(
            SalesHistory.sku.isnot(None)
        ).count()

        with_identification = db.query(SalesHistory).filter(
            (SalesHistory.product_id.isnot(None)) |
            (SalesHistory.sku.isnot(None))
        ).count()

        identification_pct = (with_identification / total_records * 100) if total_records > 0 else 0

        return {
            "total_records": total_records,
            "unique_product_ids": unique_product_ids,
            "unique_skus": unique_skus,
            "identification_pct": round(identification_pct, 2),
            "coverage": {
                "with_product_id": with_product_id,
                "with_sku": with_sku,
                "with_identification": with_identification
            }
        }

    def get_data_summary(self, db: Session) -> Dict[str, Any]:
        """
        Get summary statistics of sales history data

        Args:
            db: Database session

        Returns:
            Summary statistics
        """
        # Basic counts
        total_records = db.query(SalesHistory).count()

        if total_records == 0:
            return {
                "total_records": 0,
                "message": "No sales history data available"
            }

        # Date range
        date_range = db.query(
            func.min(SalesHistory.sale_date).label('min_date'),
            func.max(SalesHistory.sale_date).label('max_date')
        ).first()

        # Aggregate statistics
        aggregates = db.query(
            func.sum(SalesHistory.quantity_sold).label('total_quantity'),
            func.sum(SalesHistory.total_revenue).label('total_revenue'),
            func.avg(SalesHistory.quantity_sold).label('avg_quantity'),
            func.avg(SalesHistory.unit_price).label('avg_price')
        ).first()

        # Category breakdown
        by_category = db.query(
            SalesHistory.category_id,
            func.count(SalesHistory.id).label('count'),
            func.sum(SalesHistory.total_revenue).label('revenue')
        ).filter(
            SalesHistory.category_id.isnot(None)
        ).group_by(
            SalesHistory.category_id
        ).order_by(
            func.sum(SalesHistory.total_revenue).desc()
        ).limit(10).all()

        return {
            "total_records": total_records,
            "date_range": {
                "start": date_range.min_date.isoformat() if date_range.min_date else None,
                "end": date_range.max_date.isoformat() if date_range.max_date else None,
                "days": (date_range.max_date - date_range.min_date).days if date_range.min_date else 0
            },
            "aggregates": {
                "total_quantity": int(aggregates.total_quantity) if aggregates.total_quantity else 0,
                "total_revenue": float(aggregates.total_revenue) if aggregates.total_revenue else 0,
                "average_quantity": round(float(aggregates.avg_quantity), 2) if aggregates.avg_quantity else 0,
                "average_price": round(float(aggregates.avg_price), 2) if aggregates.avg_price else 0
            },
            "top_categories": [
                {
                    "category_id": cat.category_id,
                    "record_count": cat.count,
                    "total_revenue": float(cat.revenue) if cat.revenue else 0
                }
                for cat in by_category
            ]
        }
