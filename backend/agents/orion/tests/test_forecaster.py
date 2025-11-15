"""
Unit tests for Forecaster service
"""
import pytest
import pandas as pd
from datetime import date, timedelta
from unittest.mock import Mock, patch

from app.forecasting.forecaster import Forecaster
from app.models import SalesHistory, Forecast


class TestForecaster:
    """Test suite for Forecaster service"""

    def test_forecaster_initialization(self):
        """Test Forecaster initialization"""
        forecaster = Forecaster()
        assert forecaster.feature_engineer is not None

    def test_generate_forecast_no_data(self, db_session):
        """Test forecast generation with no historical data"""
        forecaster = Forecaster()

        result = forecaster.generate_forecast(
            product_id="nonexistent-id",
            sku="NONEXISTENT",
            db=db_session
        )

        assert result['success'] is False
        assert 'error' in result
        assert result['forecasts_created'] == 0

    def test_generate_forecast_insufficient_data(self, db_session):
        """Test forecast generation with insufficient data"""
        forecaster = Forecaster()

        # Add only 30 days of data (need 365)
        product_id = "12345678-1234-1234-1234-123456789012"
        for i in range(30):
            record = SalesHistory(
                product_id=product_id,
                sku="TEST-SKU",
                sale_date=date.today() - timedelta(days=30-i),
                quantity_sold=10 + i,
                revenue=(10 + i) * 25.0,
                data_source='test'
            )
            db_session.add(record)

        db_session.commit()

        result = forecaster.generate_forecast(
            product_id=product_id,
            sku="TEST-SKU",
            db=db_session
        )

        assert result['success'] is False
        assert 'Insufficient data' in result['error']

    def test_generate_forecast_sarima_success(self, sales_history_records, db_session):
        """Test successful forecast generation with SARIMA"""
        forecaster = Forecaster()

        product_id = "12345678-1234-1234-1234-123456789012"

        result = forecaster.generate_forecast(
            product_id=product_id,
            sku="TEST-SKU-001",
            forecast_horizon_days=30,
            model_name="SARIMA",
            db=db_session
        )

        assert result['success'] is True
        assert result['model_type'] == 'SARIMA'
        assert result['forecasts_created'] > 0
        assert result['forecast_horizon_days'] == 30
        assert 'training_metrics' in result
        assert 'validation_metrics' in result

    def test_generate_forecast_prophet_success(self, sales_history_records, db_session):
        """Test successful forecast generation with Prophet"""
        forecaster = Forecaster()

        product_id = "12345678-1234-1234-1234-123456789012"

        result = forecaster.generate_forecast(
            product_id=product_id,
            sku="TEST-SKU-001",
            forecast_horizon_days=30,
            model_name="Prophet",
            db=db_session
        )

        assert result['success'] is True
        assert result['model_type'] == 'Prophet'
        assert result['forecasts_created'] > 0

    def test_generate_forecast_ensemble_success(self, sales_history_records, db_session):
        """Test successful forecast generation with Ensemble"""
        forecaster = Forecaster()

        product_id = "12345678-1234-1234-1234-123456789012"

        result = forecaster.generate_forecast(
            product_id=product_id,
            sku="TEST-SKU-001",
            forecast_horizon_days=30,
            model_name="Ensemble",
            db=db_session
        )

        assert result['success'] is True
        assert result['model_type'] == 'Ensemble'
        assert result['forecasts_created'] > 0

    def test_generate_forecast_invalid_model(self, sales_history_records, db_session):
        """Test forecast generation with invalid model name"""
        forecaster = Forecaster()

        product_id = "12345678-1234-1234-1234-123456789012"

        result = forecaster.generate_forecast(
            product_id=product_id,
            sku="TEST-SKU-001",
            model_name="InvalidModel",
            db=db_session
        )

        assert result['success'] is False
        assert 'not supported' in result['error']

    def test_store_forecasts_creates_records(self, db_session):
        """Test that forecasts are stored in database"""
        forecaster = Forecaster()

        forecasts = [
            {
                'forecast_date': (date.today() + timedelta(days=i)).isoformat(),
                'predicted_quantity': 50 + i,
                'confidence_interval_lower': 40 + i,
                'confidence_interval_upper': 60 + i,
                'confidence_score': 0.95
            }
            for i in range(10)
        ]

        product_id = "12345678-1234-1234-1234-123456789012"

        count = forecaster._store_forecasts(
            forecasts=forecasts,
            product_id=product_id,
            sku="TEST-SKU",
            model_name="SARIMA",
            model_version="1.0",
            training_result={'metrics': {'mape': 5.0}},
            db=db_session
        )

        assert count == 10

        # Verify records in database
        records = db_session.query(Forecast).filter(
            Forecast.product_id == product_id
        ).all()

        assert len(records) == 10

    def test_store_forecasts_updates_existing(self, forecast_records, db_session):
        """Test that existing forecasts are updated"""
        forecaster = Forecaster()

        product_id = "12345678-1234-1234-1234-123456789012"

        # Get first forecast date
        existing_forecast = forecast_records[0]
        forecast_date = existing_forecast.forecast_date

        # Create forecast with same date
        forecasts = [{
            'forecast_date': forecast_date.isoformat(),
            'predicted_quantity': 999,  # Different value
            'confidence_interval_lower': 900,
            'confidence_interval_upper': 1100,
            'confidence_score': 0.95
        }]

        count = forecaster._store_forecasts(
            forecasts=forecasts,
            product_id=product_id,
            sku="TEST-SKU-001",
            model_name="Prophet",
            model_version="2.0",
            training_result={'metrics': {'mape': 3.0}},
            db=db_session
        )

        assert count == 1

        # Verify update
        updated = db_session.query(Forecast).filter(
            Forecast.product_id == product_id,
            Forecast.forecast_date == forecast_date
        ).first()

        assert updated.predicted_quantity == 999
        assert updated.model_name == "Prophet"

    def test_update_forecast_actuals(self, forecast_records, sales_history_records, db_session):
        """Test updating forecasts with actual values"""
        forecaster = Forecaster()

        # Get yesterday's date
        yesterday = date.today() - timedelta(days=1)

        result = forecaster.update_forecast_actuals(
            forecast_date=yesterday,
            db=db_session
        )

        assert result['success'] is True
        assert 'forecasts_checked' in result
        assert 'forecasts_updated' in result

    def test_get_accuracy_report(self, db_session):
        """Test generating accuracy report"""
        forecaster = Forecaster()

        # Create forecasts with actuals
        product_id = "12345678-1234-1234-1234-123456789012"

        for i in range(7):
            forecast_date = date.today() - timedelta(days=7-i)
            forecast = Forecast(
                product_id=product_id,
                sku="TEST-SKU",
                forecast_date=forecast_date,
                forecast_horizon='7-day',
                predicted_quantity=50 + i,
                actual_quantity=52 + i,  # Slightly different
                confidence_interval_lower=40,
                confidence_interval_upper=60,
                confidence_score=0.95,
                model_name='SARIMA',
                model_version='1.0'
            )
            forecast.calculate_error()
            db_session.add(forecast)

        db_session.commit()

        # Generate report
        start_date = date.today() - timedelta(days=7)
        end_date = date.today() - timedelta(days=1)

        report = forecaster.get_accuracy_report(
            start_date=start_date,
            end_date=end_date,
            db=db_session
        )

        assert report['success'] is True
        assert 'models' in report
        assert 'overall_mae' in report
        assert 'overall_mape' in report
        assert report['total_forecasts'] > 0

    def test_get_accuracy_report_no_data(self, db_session):
        """Test accuracy report with no data"""
        forecaster = Forecaster()

        start_date = date.today() - timedelta(days=7)
        end_date = date.today() - timedelta(days=1)

        report = forecaster.get_accuracy_report(
            start_date=start_date,
            end_date=end_date,
            db=db_session
        )

        assert report['success'] is False
        assert report['total_forecasts'] == 0

    def test_forecast_by_sku(self, sales_history_records, db_session):
        """Test forecast generation by SKU"""
        forecaster = Forecaster()

        result = forecaster.generate_forecast(
            sku="TEST-SKU-001",
            forecast_horizon_days=14,
            model_name="SARIMA",
            db=db_session
        )

        assert result['success'] is True
        assert result['forecasts_created'] > 0

    def test_different_forecast_horizons(self, sales_history_records, db_session):
        """Test forecasts with different horizons"""
        forecaster = Forecaster()

        product_id = "12345678-1234-1234-1234-123456789012"

        for horizon in [7, 14, 30]:
            result = forecaster.generate_forecast(
                product_id=product_id,
                sku="TEST-SKU-001",
                forecast_horizon_days=horizon,
                model_name="SARIMA",
                db=db_session
            )

            assert result['success'] is True
            assert result['forecast_horizon_days'] == horizon

    def test_model_info_included_in_result(self, sales_history_records, db_session):
        """Test that model info is included in results"""
        forecaster = Forecaster()

        product_id = "12345678-1234-1234-1234-123456789012"

        result = forecaster.generate_forecast(
            product_id=product_id,
            sku="TEST-SKU-001",
            model_name="SARIMA",
            db=db_session
        )

        assert 'model_info' in result
        assert result['model_info']['trained'] is True

    def test_forecast_horizon_label(self, db_session):
        """Test forecast horizon labeling"""
        forecaster = Forecaster()

        # Test different horizons get correct labels
        test_cases = [
            (7, "7-day"),
            (14, "14-day"),
            (30, "30-day"),
            (60, "60-day")
        ]

        for days, expected_label in test_cases:
            forecasts = [
                {
                    'forecast_date': (date.today() + timedelta(days=i)).isoformat(),
                    'predicted_quantity': 50,
                    'confidence_interval_lower': 40,
                    'confidence_interval_upper': 60,
                    'confidence_score': 0.95
                }
                for i in range(days)
            ]

            forecaster._store_forecasts(
                forecasts=forecasts,
                product_id=f"product-{days}",
                sku=f"SKU-{days}",
                model_name="Test",
                model_version="1.0",
                training_result={'metrics': {}},
                db=db_session
            )

            # Check label
            record = db_session.query(Forecast).filter(
                Forecast.product_id == f"product-{days}"
            ).first()

            assert record.forecast_horizon == expected_label
