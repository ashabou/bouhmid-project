"""
Unit tests for SARIMA forecasting model
"""
import pytest
import pandas as pd
import numpy as np
from datetime import date, timedelta

from app.forecasting.sarima_model import SARIMAModel


class TestSARIMAModel:
    """Test suite for SARIMA model"""

    def test_model_initialization(self):
        """Test SARIMA model initialization"""
        model = SARIMAModel()
        assert model.model is None
        assert model.model_fit is None
        assert model.order == (1, 1, 1)
        assert model.seasonal_order == (1, 1, 1, 12)

    def test_model_initialization_custom_params(self):
        """Test SARIMA model with custom parameters"""
        model = SARIMAModel(
            order=(2, 1, 2),
            seasonal_order=(1, 1, 1, 7)
        )
        assert model.order == (2, 1, 2)
        assert model.seasonal_order == (1, 1, 1, 7)

    def test_check_stationarity(self, sample_sales_data):
        """Test stationarity check"""
        model = SARIMAModel()
        series = sample_sales_data['quantity_sold']

        result = model.check_stationarity(series)

        assert 'adf_statistic' in result
        assert 'p_value' in result
        assert 'is_stationary' in result
        assert 'critical_values' in result
        assert isinstance(result['is_stationary'], bool)

    def test_train_model_success(self, sample_sales_data):
        """Test successful model training"""
        model = SARIMAModel()

        result = model.train(sample_sales_data, target_col='quantity_sold')

        assert result['success'] is True
        assert result['model_type'] == 'SARIMA'
        assert 'aic' in result
        assert 'bic' in result
        assert result['training_samples'] == len(sample_sales_data)
        assert 'metrics' in result
        assert 'mae' in result['metrics']
        assert 'rmse' in result['metrics']
        assert 'mape' in result['metrics']
        assert 'r2_score' in result['metrics']

    def test_train_model_with_date_column(self, sample_sales_data):
        """Test training with explicit date column"""
        model = SARIMAModel()

        # Ensure sale_date column exists
        assert 'sale_date' in sample_sales_data.columns

        result = model.train(sample_sales_data, target_col='quantity_sold')

        assert result['success'] is True
        assert model.model_fit is not None
        assert model.training_data is not None

    def test_train_insufficient_data(self):
        """Test training with insufficient data"""
        model = SARIMAModel()

        # Only 10 days of data
        data = pd.DataFrame({
            'sale_date': pd.date_range(start='2024-01-01', periods=10),
            'quantity_sold': np.random.randint(1, 100, 10)
        })

        result = model.train(data, target_col='quantity_sold')

        # Should still attempt training but might fail or have poor metrics
        assert 'success' in result

    def test_predict_before_training(self):
        """Test prediction fails before training"""
        model = SARIMAModel()

        with pytest.raises(ValueError, match="Model must be trained"):
            model.predict(steps=30)

    def test_predict_after_training(self, sample_sales_data):
        """Test prediction after training"""
        model = SARIMAModel()

        # Train model
        model.train(sample_sales_data, target_col='quantity_sold')

        # Generate predictions
        result = model.predict(steps=30, confidence_level=0.95)

        assert result['success'] is True
        assert result['model_type'] == 'SARIMA'
        assert len(result['forecasts']) == 30
        assert result['forecast_horizon'] == 30

        # Check forecast structure
        forecast = result['forecasts'][0]
        assert 'forecast_date' in forecast
        assert 'predicted_quantity' in forecast
        assert 'confidence_interval_lower' in forecast
        assert 'confidence_interval_upper' in forecast
        assert forecast['confidence_score'] == 0.95

    def test_predict_different_horizons(self, sample_sales_data):
        """Test predictions with different forecast horizons"""
        model = SARIMAModel()
        model.train(sample_sales_data, target_col='quantity_sold')

        for horizon in [7, 14, 30, 60]:
            result = model.predict(steps=horizon)
            assert result['success'] is True
            assert len(result['forecasts']) == horizon

    def test_evaluate_model(self, sample_sales_data):
        """Test model evaluation on test data"""
        model = SARIMAModel()

        # Split data
        train_size = int(len(sample_sales_data) * 0.8)
        train_data = sample_sales_data[:train_size]
        test_data = sample_sales_data[train_size:]

        # Train on training data
        model.train(train_data, target_col='quantity_sold')

        # Evaluate on test data
        result = model.evaluate(test_data, target_col='quantity_sold')

        assert result['success'] is True
        assert result['model_type'] == 'SARIMA'
        assert 'metrics' in result
        assert result['metrics']['mae'] >= 0
        assert result['metrics']['rmse'] >= 0
        assert result['metrics']['mape'] >= 0

    def test_calculate_metrics(self, sample_sales_data):
        """Test metrics calculation"""
        model = SARIMAModel()

        actuals = np.array([100, 110, 105, 115, 120])
        predictions = np.array([98, 112, 103, 117, 118])

        metrics = model._calculate_metrics(actuals, predictions)

        assert 'mae' in metrics
        assert 'rmse' in metrics
        assert 'mape' in metrics
        assert 'r2_score' in metrics
        assert metrics['mae'] > 0
        assert metrics['rmse'] > 0
        assert metrics['mape'] > 0

    def test_calculate_metrics_with_zeros(self):
        """Test metrics calculation with zero values"""
        model = SARIMAModel()

        actuals = np.array([0, 10, 0, 15, 20])
        predictions = np.array([2, 12, 1, 17, 18])

        metrics = model._calculate_metrics(actuals, predictions)

        # Should handle zeros gracefully
        assert 'mape' in metrics
        assert not np.isnan(metrics['mape'])

    def test_auto_select_order(self, sample_sales_data):
        """Test automatic order selection"""
        model = SARIMAModel()

        series = sample_sales_data.set_index('sale_date')['quantity_sold']

        # Test with small max values for speed
        order = model.auto_select_order(series, max_p=2, max_d=1, max_q=2)

        assert isinstance(order, tuple)
        assert len(order) == 3
        assert all(isinstance(x, int) for x in order)
        assert all(x >= 0 for x in order)

    def test_train_with_auto_order(self, sample_sales_data):
        """Test training with automatic order selection"""
        model = SARIMAModel()

        result = model.train(
            sample_sales_data,
            target_col='quantity_sold',
            auto_order=True
        )

        assert result['success'] is True
        # Order should be auto-selected
        assert 'order' in result

    def test_get_model_info_untrained(self):
        """Test getting model info before training"""
        model = SARIMAModel()

        info = model.get_model_info()

        assert info['trained'] is False
        assert 'message' in info

    def test_get_model_info_trained(self, sample_sales_data):
        """Test getting model info after training"""
        model = SARIMAModel()
        model.train(sample_sales_data, target_col='quantity_sold')

        info = model.get_model_info()

        assert info['trained'] is True
        assert info['model_type'] == 'SARIMA'
        assert 'order' in info
        assert 'seasonal_order' in info
        assert 'aic' in info
        assert 'bic' in info
        assert 'metrics' in info

    def test_model_persistence(self, sample_sales_data, tmp_path):
        """Test saving and loading model"""
        model = SARIMAModel()
        model.train(sample_sales_data, target_col='quantity_sold')

        # Save model
        model_path = tmp_path / "sarima_model.pkl"
        success = model.save(str(model_path))
        assert success is True
        assert model_path.exists()

        # Load model
        new_model = SARIMAModel()
        success = new_model.load(str(model_path))
        assert success is True
        assert new_model.model_fit is not None
        assert new_model.order == model.order
        assert new_model.seasonal_order == model.seasonal_order

        # Predictions should work
        result = new_model.predict(steps=7)
        assert result['success'] is True

    def test_save_untrained_model(self, tmp_path):
        """Test saving untrained model fails gracefully"""
        model = SARIMAModel()
        model_path = tmp_path / "untrained_model.pkl"

        success = model.save(str(model_path))
        assert success is False

    def test_load_nonexistent_model(self, tmp_path):
        """Test loading non-existent model"""
        model = SARIMAModel()
        model_path = tmp_path / "nonexistent.pkl"

        success = model.load(str(model_path))
        assert success is False

    def test_forecast_dates_sequential(self, sample_sales_data):
        """Test that forecast dates are sequential"""
        model = SARIMAModel()
        model.train(sample_sales_data, target_col='quantity_sold')

        result = model.predict(steps=10)

        forecasts = result['forecasts']
        dates = [pd.to_datetime(f['forecast_date']).date() for f in forecasts]

        # Check dates are sequential
        for i in range(1, len(dates)):
            assert dates[i] == dates[i-1] + timedelta(days=1)

    def test_confidence_intervals_valid(self, sample_sales_data):
        """Test that confidence intervals are valid"""
        model = SARIMAModel()
        model.train(sample_sales_data, target_col='quantity_sold')

        result = model.predict(steps=30)

        for forecast in result['forecasts']:
            pred = forecast['predicted_quantity']
            lower = forecast['confidence_interval_lower']
            upper = forecast['confidence_interval_upper']

            # Lower should be less than prediction, upper should be greater
            assert lower <= pred
            assert upper >= pred
