"""
CSV Sales History Importer

Validates, cleans, and imports historical sales data from CSV files
"""
import csv
import logging
from typing import List, Dict, Any, Tuple
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from ..models.sales_history import SalesHistory
from ..config import settings

logger = logging.getLogger(__name__)


class CSVImportError(Exception):
    """Custom exception for CSV import errors"""
    pass


class CSVImporter:
    """
    CSV importer for sales history data

    Handles validation, cleaning, and import of historical sales data.
    """

    # Required CSV columns
    REQUIRED_COLUMNS = ['sale_date', 'quantity_sold', 'unit_price']

    # Optional columns
    OPTIONAL_COLUMNS = [
        'product_id', 'sku', 'product_name',
        'brand_id', 'category_id', 'customer_type',
        'total_revenue'
    ]

    # Date formats to try
    DATE_FORMATS = [
        '%Y-%m-%d',          # 2023-01-15
        '%Y/%m/%d',          # 2023/01/15
        '%d-%m-%Y',          # 15-01-2023
        '%d/%m/%Y',          # 15/01/2023
        '%m/%d/%Y',          # 01/15/2023
        '%Y%m%d',            # 20230115
    ]

    def __init__(self):
        """Initialize CSV importer"""
        self.logger = logger

    def validate_file(self, file_path: str) -> Dict[str, Any]:
        """
        Validate CSV file structure and content

        Args:
            file_path: Path to CSV file

        Returns:
            Validation result dictionary

        Raises:
            CSVImportError: If validation fails
        """
        path = Path(file_path)

        # Check file exists
        if not path.exists():
            raise CSVImportError(f"File not found: {file_path}")

        # Check file extension
        if path.suffix.lower() not in ['.csv', '.txt']:
            raise CSVImportError(f"Invalid file type: {path.suffix}. Expected .csv")

        errors = []
        warnings = []
        row_count = 0

        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                # Read first line to get headers
                reader = csv.DictReader(f)
                headers = reader.fieldnames or []

                # Validate required columns
                missing_columns = [
                    col for col in self.REQUIRED_COLUMNS
                    if col not in headers
                ]
                if missing_columns:
                    raise CSVImportError(
                        f"Missing required columns: {', '.join(missing_columns)}"
                    )

                # Check for extra columns
                recognized_columns = self.REQUIRED_COLUMNS + self.OPTIONAL_COLUMNS
                extra_columns = [
                    col for col in headers
                    if col not in recognized_columns
                ]
                if extra_columns:
                    warnings.append(
                        f"Unrecognized columns will be ignored: {', '.join(extra_columns)}"
                    )

                # Validate sample rows
                sample_errors = []
                for idx, row in enumerate(reader, start=2):  # Start at 2 (header is 1)
                    if idx > 100:  # Only validate first 100 rows for performance
                        break

                    row_count += 1
                    row_errors = self._validate_row(row, idx)
                    if row_errors:
                        sample_errors.extend(row_errors)

                    if len(sample_errors) >= 10:  # Limit error reporting
                        sample_errors.append(f"... (stopped after 10 errors)")
                        break

                errors.extend(sample_errors)

                # Count remaining rows
                for _ in reader:
                    row_count += 1

        except csv.Error as e:
            raise CSVImportError(f"CSV parsing error: {str(e)}")
        except Exception as e:
            raise CSVImportError(f"Validation error: {str(e)}")

        return {
            "valid": len(errors) == 0,
            "row_count": row_count,
            "headers": headers,
            "errors": errors,
            "warnings": warnings
        }

    def _validate_row(self, row: Dict[str, str], row_num: int) -> List[str]:
        """
        Validate a single CSV row

        Args:
            row: CSV row as dictionary
            row_num: Row number for error reporting

        Returns:
            List of error messages
        """
        errors = []

        # Validate sale_date
        if not row.get('sale_date'):
            errors.append(f"Row {row_num}: Missing sale_date")
        else:
            parsed_date = self._parse_date(row['sale_date'])
            if not parsed_date:
                errors.append(
                    f"Row {row_num}: Invalid date format: {row['sale_date']}"
                )

        # Validate quantity_sold
        if not row.get('quantity_sold'):
            errors.append(f"Row {row_num}: Missing quantity_sold")
        else:
            try:
                qty = int(row['quantity_sold'])
                if qty <= 0:
                    errors.append(
                        f"Row {row_num}: quantity_sold must be positive: {qty}"
                    )
            except ValueError:
                errors.append(
                    f"Row {row_num}: Invalid quantity_sold: {row['quantity_sold']}"
                )

        # Validate unit_price
        if not row.get('unit_price'):
            errors.append(f"Row {row_num}: Missing unit_price")
        else:
            try:
                price = Decimal(row['unit_price'])
                if price <= 0:
                    errors.append(
                        f"Row {row_num}: unit_price must be positive: {price}"
                    )
            except (InvalidOperation, ValueError):
                errors.append(
                    f"Row {row_num}: Invalid unit_price: {row['unit_price']}"
                )

        return errors

    def _parse_date(self, date_str: str) -> date:
        """
        Parse date string using multiple formats

        Args:
            date_str: Date string to parse

        Returns:
            Parsed date or None if parsing fails
        """
        for fmt in self.DATE_FORMATS:
            try:
                return datetime.strptime(date_str.strip(), fmt).date()
            except ValueError:
                continue
        return None

    def import_csv(
        self,
        file_path: str,
        db: Session,
        validate_only: bool = False,
        skip_duplicates: bool = True,
        batch_size: int = 1000
    ) -> Dict[str, Any]:
        """
        Import CSV file into database

        Args:
            file_path: Path to CSV file
            db: Database session
            validate_only: Only validate, don't import
            skip_duplicates: Skip duplicate entries
            batch_size: Number of records to insert per batch

        Returns:
            Import summary dictionary
        """
        self.logger.info(f"Starting CSV import: {file_path}")

        # Validate file first
        validation = self.validate_file(file_path)
        if not validation['valid']:
            return {
                "success": False,
                "message": "Validation failed",
                "records_imported": 0,
                "records_skipped": 0,
                "records_failed": 0,
                "errors": validation['errors']
            }

        if validate_only:
            return {
                "success": True,
                "message": "Validation successful",
                "records_imported": 0,
                "records_skipped": 0,
                "records_failed": 0,
                "row_count": validation['row_count'],
                "warnings": validation['warnings']
            }

        # Import data
        imported = 0
        skipped = 0
        failed = 0
        errors = []
        batch = []

        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)

                for idx, row in enumerate(reader, start=2):
                    try:
                        # Parse and create sales history record
                        sales_record = self._parse_row(row)

                        # Check for duplicates if enabled
                        if skip_duplicates and self._is_duplicate(sales_record, db):
                            skipped += 1
                            continue

                        batch.append(sales_record)

                        # Insert batch
                        if len(batch) >= batch_size:
                            imported += self._insert_batch(batch, db)
                            batch = []

                    except Exception as e:
                        failed += 1
                        error_msg = f"Row {idx}: {str(e)}"
                        errors.append(error_msg)
                        self.logger.warning(error_msg)

                        if len(errors) >= 100:  # Limit error collection
                            errors.append("... (too many errors, stopping collection)")
                            break

                # Insert remaining batch
                if batch:
                    imported += self._insert_batch(batch, db)

            db.commit()
            self.logger.info(
                f"Import complete: {imported} imported, {skipped} skipped, {failed} failed"
            )

            return {
                "success": True,
                "message": f"Successfully imported {imported} records",
                "records_imported": imported,
                "records_skipped": skipped,
                "records_failed": failed,
                "errors": errors[:50] if errors else None  # Limit errors in response
            }

        except Exception as e:
            db.rollback()
            self.logger.error(f"Import failed: {str(e)}", exc_info=True)
            return {
                "success": False,
                "message": f"Import failed: {str(e)}",
                "records_imported": imported,
                "records_skipped": skipped,
                "records_failed": failed,
                "errors": errors
            }

    def _parse_row(self, row: Dict[str, str]) -> SalesHistory:
        """
        Parse CSV row into SalesHistory object

        Args:
            row: CSV row dictionary

        Returns:
            SalesHistory object
        """
        # Parse required fields
        sale_date = self._parse_date(row['sale_date'])
        quantity_sold = int(row['quantity_sold'])
        unit_price = Decimal(row['unit_price'])

        # Calculate total revenue if not provided
        total_revenue = row.get('total_revenue')
        if total_revenue:
            total_revenue = Decimal(total_revenue)
        else:
            total_revenue = Decimal(quantity_sold) * unit_price

        # Parse optional fields
        product_id = row.get('product_id') or None
        sku = row.get('sku') or None
        product_name = row.get('product_name') or None
        brand_id = int(row['brand_id']) if row.get('brand_id') else None
        category_id = int(row['category_id']) if row.get('category_id') else None
        customer_type = row.get('customer_type') or None

        return SalesHistory(
            sale_date=sale_date,
            product_id=product_id,
            sku=sku,
            product_name=product_name,
            quantity_sold=quantity_sold,
            unit_price=unit_price,
            total_revenue=total_revenue,
            brand_id=brand_id,
            category_id=category_id,
            customer_type=customer_type,
            imported_from="csv"
        )

    def _is_duplicate(self, record: SalesHistory, db: Session) -> bool:
        """
        Check if record is a duplicate

        A duplicate is defined as same sale_date + product_id/sku + quantity

        Args:
            record: Sales history record
            db: Database session

        Returns:
            True if duplicate exists
        """
        query = db.query(SalesHistory).filter(
            SalesHistory.sale_date == record.sale_date,
            SalesHistory.quantity_sold == record.quantity_sold
        )

        if record.product_id:
            query = query.filter(SalesHistory.product_id == record.product_id)
        elif record.sku:
            query = query.filter(SalesHistory.sku == record.sku)
        else:
            # If no product_id or sku, also match by product_name
            if record.product_name:
                query = query.filter(SalesHistory.product_name == record.product_name)

        return query.first() is not None

    def _insert_batch(self, batch: List[SalesHistory], db: Session) -> int:
        """
        Insert a batch of records

        Args:
            batch: List of SalesHistory objects
            db: Database session

        Returns:
            Number of records inserted
        """
        try:
            db.bulk_save_objects(batch)
            db.flush()
            return len(batch)
        except IntegrityError as e:
            db.rollback()
            self.logger.error(f"Batch insert failed: {str(e)}")
            # Try inserting one by one
            inserted = 0
            for record in batch:
                try:
                    db.add(record)
                    db.flush()
                    inserted += 1
                except Exception:
                    db.rollback()
            return inserted
        except Exception as e:
            db.rollback()
            self.logger.error(f"Batch insert error: {str(e)}", exc_info=True)
            return 0
