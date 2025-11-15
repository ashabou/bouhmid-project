"""
Unit tests for Prophet forecasting model
"""
import pytest
import pandas as pd
import numpy as np
from datetime import date, timedelta

from app.forecasting.prophet_model import ProphetModel


class TestProphetModel:
    """Test suite for Prophet model"""

    def test_model_initialization(self):
        """Test Prophet model initialization"""
        model = ProphetModel()
        assert model.model is None
        assert model.yearly_seasonality is True
        assert model.weekly_seasonality is True
        assert model.daily_seasonality is False

    def test_model_initialization_custom_params(self):
        """Test Prophet model with custom parameters"""
        model = ProphetModel(
            yearly_seasonality=False,
            weekly_seasonality=True,
            daily_seasonality=True,
            changepoint_prior_scale=0.1
        )
        assert model.yearly_seasonality is False
        assert model.weekly_seasonality is True
        assert model.daily_seasonality is True
        assert model.changepoint_prior_scale == 0.1

    def test_prepare_prophet_df(self, sample_sales_data):
        """Test data preparation for Prophet format"""
        model = ProphetModel()

        prophet_df = model._prepare_prophet_df(
            sample_sales_data,
            date_col='sale_date',
            target_col='quantity_sold'
        )

        assert 'ds' in prophet_df.columns
        assert 'y' in prophet_df.columns
        assert len(prophet_df) == len(sample_sales_data)
        assert pd.api.types.is_datetime64_any_dtype(prophet_df['ds'])

    def test_train_model_success(self, sample_sales_data):
        """Test successful model training"""
        model = ProphetModel()

        result = model.train(
            sample_sales_data,
            target_col='quantity_sold',
            date_col='sale_date'
        )

        assert result['success'] is True
        assert result['model_type'] == 'Prophet'
        assert result['training_samples'] == len(sample_sales_data)
        assert 'metrics' in result
        assert 'mae' in result['metrics']
        assert 'rmse' in result['metrics']
        assert 'mape' in result['metrics']
        assert 'r2_score' in result['metrics']

    def test_train_model_preserves_settings(self, sample_sales_data):
        """Test that training preserves model settings"""
        model = ProphetModel(
            yearly_seasonality=False,
            weekly_seasonality=True
        )

        result = model.train(sample_sales_data, target_col='quantity_sold')

        assert result['success'] is True
        assert result['yearly_seasonality'] is False
        assert result['weekly_seasonality'] is True

    def test_predict_before_training(self):
        """Test prediction fails before training"""
        model = ProphetModel()

        with pytest.raises(ValueError, match="Model must be trained"):
            model.predict(steps=30)

    def test_predict_after_training(self, sample_sales_data):
        """Test prediction after training"""
        model = ProphetModel()
        model.train(sample_sales_data, target_col='quantity_sold')

        result = model.predict(steps=30, confidence_level=0.95)

        assert result['success'] is True
        assert result['model_type'] == 'Prophet'
        assert len(result['forecasts']) == 30
        assert result['forecast_horizon'] == 30

        # Check forecast structure
        forecast = result['forecasts'][0]
        assert 'forecast_date' in forecast
        assert 'predicted_quantity' in forecast
        assert 'confidence_interval_lower' in forecast
        assert 'confidence_interval_upper' in forecast
        assert 'trend' in forecast
        assert 'seasonal' in forecast
        assert forecast['confidence_score'] == 0.95

    def test_predict_non_negative(self, sample_sales_data):
        """Test that predictions are non-negative"""
        model = ProphetModel()
        model.train(sample_sales_data, target_col='quantity_sold')

        result = model.predict(steps=30)

        for forecast in result['forecasts']:
            assert forecast['predicted_quantity'] >= 0
            assert forecast['confidence_interval_lower'] >= 0
            assert forecast['confidence_interval_upper'] >= 0

    def test_predict_different_horizons(self, sample_sales_data):
        """Test predictions with different forecast horizons"""
        model = ProphetModel()
        model.train(sample_sales_data, target_col='quantity_sold')

        for horizon in [7, 14, 30, 60]:
            result = model.predict(steps=horizon)
            assert result['success'] is True
            assert len(result['forecasts']) == horizon

    def test_evaluate_model(self, sample_sales_data):
        """Test model evaluation on test data"""
        model = ProphetModel()

        # Split data
        train_size = int(len(sample_sales_data) * 0.8)
        train_data = sample_sales_data[:train_size]
        test_data = sample_sales_data[train_size:]

        # Train on training data
        model.train(train_data, target_col='quantity_sold')

        # Evaluate on test data
        result = model.evaluate(test_data, target_col='quantity_sold')

        assert result['success'] is True
        assert result['model_type'] == 'Prophet'
        assert 'metrics' in result
        assert result['metrics']['mae'] >= 0
        assert result['metrics']['rmse'] >= 0
        assert result['metrics']['mape'] >= 0

    def test_get_seasonality_components(self, sample_sales_data):
        """Test extracting seasonality components"""
        model = ProphetModel()
        model.train(sample_sales_data, target_col='quantity_sold')

        components = model.get_seasonality_components()

        assert components is not None
        assert 'trend' in components
        assert 'dates' in components
        assert len(components['trend']) > 0
        assert len(components['dates']) > 0

    def test_calculate_metrics(self):
        """Test metrics calculation"""
        model = ProphetModel()

        actuals = np.array([100, 110, 105, 115, 120])
        predictions = np.array([98, 112, 103, 117, 118])

        metrics = model._calculate_metrics(actuals, predictions)

        assert 'mae' in metrics
        assert 'rmse' in metrics
        assert 'mape' in metrics
        assert 'r2_score' in metrics
        assert metrics['mae'] > 0
        assert metrics['rmse'] > 0

    def test_get_model_info_untrained(self):
        """Test getting model info before training"""
        model = ProphetModel()

        info = model.get_model_info()

        assert info['trained'] is False
        assert 'message' in info

    def test_get_model_info_trained(self, sample_sales_data):
        """Test getting model info after training"""
        model = ProphetModel()
        model.train(sample_sales_data, target_col='quantity_sold')

        info = model.get_model_info()

        assert info['trained'] is True
        assert info['model_type'] == 'Prophet'
        assert 'yearly_seasonality' in info
        assert 'weekly_seasonality' in info
        assert 'metrics' in info

    def test_model_persistence(self, sample_sales_data, tmp_path):
        """Test saving and loading model"""
        model = ProphetModel()
        model.train(sample_sales_data, target_col='quantity_sold')

        # Save model
        model_path = tmp_path / "prophet_model.pkl"
        success = model.save(str(model_path))
        assert success is True
        assert model_path.exists()

        # Load model
        new_model = ProphetModel()
        success = new_model.load(str(model_path))
        assert success is True
        assert new_model.model is not None
        assert new_model.yearly_seasonality == model.yearly_seasonality
        assert new_model.weekly_seasonality == model.weekly_seasonality

        # Predictions should work
        result = new_model.predict(steps=7)
        assert result['success'] is True

    def test_save_untrained_model(self, tmp_path):
        """Test saving untrained model fails gracefully"""
        model = ProphetModel()
        model_path = tmp_path / "untrained_model.pkl"

        success = model.save(str(model_path))
        assert success is False

    def test_load_nonexistent_model(self, tmp_path):
        """Test loading non-existent model"""
        model = ProphetModel()
        model_path = tmp_path / "nonexistent.pkl"

        success = model.load(str(model_path))
        assert success is False

    def test_forecast_dates_sequential(self, sample_sales_data):
        """Test that forecast dates are sequential"""
        model = ProphetModel()
        model.train(sample_sales_data, target_col='quantity_sold')

        result = model.predict(steps=10)

        forecasts = result['forecasts']
        dates = [pd.to_datetime(f['forecast_date']).date() for f in forecasts]

        # Check dates are sequential
        for i in range(1, len(dates)):
            assert dates[i] == dates[i-1] + timedelta(days=1)

    def test_confidence_intervals_valid(self, sample_sales_data):
        """Test that confidence intervals are valid"""
        model = ProphetModel()
        model.train(sample_sales_data, target_col='quantity_sold')

        result = model.predict(steps=30)

        for forecast in result['forecasts']:
            pred = forecast['predicted_quantity']
            lower = forecast['confidence_interval_lower']
            upper = forecast['confidence_interval_upper']

            # Lower should be less than or equal to prediction
            # Upper should be greater than or equal to prediction
            assert lower <= pred
            assert upper >= pred

    def test_handles_missing_date_column(self):
        """Test handling of missing date column"""
        model = ProphetModel()

        # Data without sale_date column
        data = pd.DataFrame({
            'quantity_sold': [10, 20, 30, 40, 50]
        })

        with pytest.raises(ValueError, match="Date column"):
            model.train(data, target_col='quantity_sold')

    def test_train_with_index_as_date(self, sample_sales_data):
        """Test training when date is in index"""
        model = ProphetModel()

        # Set date as index
        data_with_index = sample_sales_data.set_index('sale_date')

        result = model.train(data_with_index, target_col='quantity_sold')

        assert result['success'] is True

    def test_yearly_seasonality_detection(self):
        """Test yearly seasonality is detected"""
        model = ProphetModel(yearly_seasonality=True)

        # Generate 2 years of data with yearly pattern
        dates = pd.date_range(start='2022-01-01', periods=730, freq='D')
        yearly_pattern = 50 * np.sin(2 * np.pi * np.arange(730) / 365)
        data = pd.DataFrame({
            'sale_date': dates,
            'quantity_sold': 100 + yearly_pattern + np.random.normal(0, 5, 730)
        })

        result = model.train(data, target_col='quantity_sold')

        assert result['success'] is True
        assert result['yearly_seasonality'] is True

    def test_weekly_seasonality_detection(self, sample_sales_data):
        """Test weekly seasonality is detected"""
        model = ProphetModel(weekly_seasonality=True)

        result = model.train(sample_sales_data, target_col='quantity_sold')

        assert result['success'] is True
        assert result['weekly_seasonality'] is True
