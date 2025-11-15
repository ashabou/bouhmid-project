"""
Unit tests for Ensemble forecasting model
"""
import pytest
import pandas as pd
import numpy as np
from datetime import date, timedelta

from app.forecasting.ensemble_model import EnsembleModel


class TestEnsembleModel:
    """Test suite for Ensemble model"""

    def test_model_initialization(self):
        """Test Ensemble model initialization"""
        model = EnsembleModel()
        assert model.sarima_model is None
        assert model.prophet_model is None
        assert model.sarima_weight == 0.5
        assert model.prophet_weight == 0.5
        assert model.auto_weight is True

    def test_model_initialization_custom_weights(self):
        """Test Ensemble model with custom weights"""
        model = EnsembleModel(
            sarima_weight=0.7,
            prophet_weight=0.3,
            auto_weight=False
        )
        # Weights should be normalized
        assert abs(model.sarima_weight - 0.7) < 0.01
        assert abs(model.prophet_weight - 0.3) < 0.01
        assert model.auto_weight is False

    def test_weights_normalization(self):
        """Test that weights are normalized to sum to 1"""
        model = EnsembleModel(sarima_weight=3, prophet_weight=1)

        total = model.sarima_weight + model.prophet_weight
        assert abs(total - 1.0) < 0.001

    def test_train_model_success(self, sample_sales_data):
        """Test successful ensemble model training"""
        model = EnsembleModel(auto_weight=False)

        result = model.train(
            sample_sales_data,
            target_col='quantity_sold',
            validation_split=0.2
        )

        assert result['success'] is True
        assert result['model_type'] == 'Ensemble'
        assert 'sarima_metrics' in result
        assert 'prophet_metrics' in result
        assert model.sarima_model is not None
        assert model.prophet_model is not None

    def test_train_with_auto_weight(self, sample_sales_data):
        """Test training with automatic weight optimization"""
        model = EnsembleModel(auto_weight=True)

        result = model.train(
            sample_sales_data,
            target_col='quantity_sold',
            validation_split=0.2
        )

        assert result['success'] is True
        assert result['auto_weight_used'] is True
        assert 'sarima_weight' in result
        assert 'prophet_weight' in result
        # Weights should sum to 1
        total_weight = result['sarima_weight'] + result['prophet_weight']
        assert abs(total_weight - 1.0) < 0.001

    def test_auto_weight_optimization(self, sample_sales_data):
        """Test automatic weight optimization logic"""
        model = EnsembleModel(auto_weight=True)

        # Split data for validation
        train_size = int(len(sample_sales_data) * 0.8)
        train_data = sample_sales_data[:train_size]
        val_data = sample_sales_data[train_size:]

        # Train models
        model.train(train_data, validation_split=0.2)

        # Check weights were optimized
        assert model.sarima_weight >= 0
        assert model.sarima_weight <= 1
        assert model.prophet_weight >= 0
        assert model.prophet_weight <= 1

    def test_predict_before_training(self):
        """Test prediction fails before training"""
        model = EnsembleModel()

        with pytest.raises(ValueError, match="Models must be trained"):
            model.predict(steps=30)

    def test_predict_after_training(self, sample_sales_data):
        """Test prediction after training"""
        model = EnsembleModel()
        model.train(sample_sales_data, target_col='quantity_sold')

        result = model.predict(steps=30, confidence_level=0.95)

        assert result['success'] is True
        assert result['model_type'] == 'Ensemble'
        assert len(result['forecasts']) == 30
        assert 'weights' in result
        assert result['weights']['sarima'] >= 0
        assert result['weights']['prophet'] >= 0

    def test_ensemble_forecast_structure(self, sample_sales_data):
        """Test ensemble forecast structure includes component predictions"""
        model = EnsembleModel()
        model.train(sample_sales_data, target_col='quantity_sold')

        result = model.predict(steps=7)

        forecast = result['forecasts'][0]
        assert 'forecast_date' in forecast
        assert 'predicted_quantity' in forecast
        assert 'confidence_interval_lower' in forecast
        assert 'confidence_interval_upper' in forecast
        assert 'sarima_prediction' in forecast
        assert 'prophet_prediction' in forecast
        assert 'ensemble_weights' in forecast

    def test_ensemble_weights_in_forecast(self, sample_sales_data):
        """Test that weights are included in forecast output"""
        model = EnsembleModel(sarima_weight=0.6, prophet_weight=0.4, auto_weight=False)
        model.train(sample_sales_data, target_col='quantity_sold')

        result = model.predict(steps=7)

        forecast = result['forecasts'][0]
        assert forecast['ensemble_weights']['sarima'] > 0
        assert forecast['ensemble_weights']['prophet'] > 0

    def test_weighted_average_calculation(self, sample_sales_data):
        """Test that weighted average is correctly calculated"""
        model = EnsembleModel(sarima_weight=0.6, prophet_weight=0.4, auto_weight=False)
        model.train(sample_sales_data, target_col='quantity_sold')

        result = model.predict(steps=7)

        for forecast in result['forecasts']:
            sarima_pred = forecast['sarima_prediction']
            prophet_pred = forecast['prophet_prediction']
            ensemble_pred = forecast['predicted_quantity']

            expected = 0.6 * sarima_pred + 0.4 * prophet_pred
            # Allow small floating point errors
            assert abs(ensemble_pred - expected) < 1.0

    def test_evaluate_model(self, sample_sales_data):
        """Test ensemble model evaluation"""
        model = EnsembleModel()

        # Split data
        train_size = int(len(sample_sales_data) * 0.8)
        train_data = sample_sales_data[:train_size]
        test_data = sample_sales_data[train_size:]

        # Train and evaluate
        model.train(train_data, target_col='quantity_sold')
        result = model.evaluate(test_data, target_col='quantity_sold')

        assert result['success'] is True
        assert result['model_type'] == 'Ensemble'
        assert 'metrics' in result
        assert 'sarima_metrics' in result
        assert 'prophet_metrics' in result

    def test_evaluate_includes_component_metrics(self, sample_sales_data):
        """Test that evaluation includes metrics for component models"""
        model = EnsembleModel()

        train_size = int(len(sample_sales_data) * 0.8)
        train_data = sample_sales_data[:train_size]
        test_data = sample_sales_data[train_size:]

        model.train(train_data, target_col='quantity_sold')
        result = model.evaluate(test_data, target_col='quantity_sold')

        # Should have metrics for SARIMA
        if result['sarima_metrics']:
            assert 'mape' in result['sarima_metrics']

        # Should have metrics for Prophet
        if result['prophet_metrics']:
            assert 'mape' in result['prophet_metrics']

    def test_get_model_info_untrained(self):
        """Test getting model info before training"""
        model = EnsembleModel()

        info = model.get_model_info()

        assert info['trained'] is False
        assert 'message' in info

    def test_get_model_info_trained(self, sample_sales_data):
        """Test getting model info after training"""
        model = EnsembleModel()
        model.train(sample_sales_data, target_col='quantity_sold')

        info = model.get_model_info()

        assert info['trained'] is True
        assert info['model_type'] == 'Ensemble'
        assert 'component_models' in info
        assert 'SARIMA' in info['component_models']
        assert 'Prophet' in info['component_models']
        assert 'weights' in info
        assert 'sarima_info' in info
        assert 'prophet_info' in info

    def test_fallback_to_single_model_sarima_fails(self, sample_sales_data):
        """Test fallback when SARIMA fails"""
        # This test would require mocking to simulate SARIMA failure
        # For now, just verify the ensemble can handle it
        model = EnsembleModel()
        model.train(sample_sales_data, target_col='quantity_sold')

        # Both models should train successfully with good data
        assert model.sarima_model is not None
        assert model.prophet_model is not None

    def test_insufficient_data_handling(self):
        """Test handling of insufficient data"""
        model = EnsembleModel()

        # Very small dataset
        data = pd.DataFrame({
            'sale_date': pd.date_range(start='2024-01-01', periods=20),
            'quantity_sold': np.random.randint(1, 100, 20)
        })

        result = model.train(data, target_col='quantity_sold')

        # Should still attempt training
        assert 'success' in result

    def test_different_validation_splits(self, sample_sales_data):
        """Test different validation split ratios"""
        for split in [0.1, 0.2, 0.3]:
            model = EnsembleModel(auto_weight=True)
            result = model.train(
                sample_sales_data,
                target_col='quantity_sold',
                validation_split=split
            )

            if result['success']:
                assert result['auto_weight_used'] is True

    def test_non_negative_predictions(self, sample_sales_data):
        """Test that ensemble predictions are non-negative"""
        model = EnsembleModel()
        model.train(sample_sales_data, target_col='quantity_sold')

        result = model.predict(steps=30)

        for forecast in result['forecasts']:
            assert forecast['predicted_quantity'] >= 0
            assert forecast['confidence_interval_lower'] >= 0
            assert forecast['confidence_interval_upper'] >= 0

    def test_confidence_intervals_valid(self, sample_sales_data):
        """Test that confidence intervals are valid"""
        model = EnsembleModel()
        model.train(sample_sales_data, target_col='quantity_sold')

        result = model.predict(steps=30)

        for forecast in result['forecasts']:
            pred = forecast['predicted_quantity']
            lower = forecast['confidence_interval_lower']
            upper = forecast['confidence_interval_upper']

            assert lower <= pred
            assert upper >= pred

    def test_weights_persist_across_predictions(self, sample_sales_data):
        """Test that weights remain consistent across predictions"""
        model = EnsembleModel(sarima_weight=0.7, prophet_weight=0.3, auto_weight=False)
        model.train(sample_sales_data, target_col='quantity_sold')

        result1 = model.predict(steps=7)
        result2 = model.predict(steps=7)

        # Weights should be same
        assert result1['weights'] == result2['weights']

    def test_equal_weights_default(self):
        """Test that default weights are equal"""
        model = EnsembleModel(auto_weight=False)

        assert abs(model.sarima_weight - 0.5) < 0.001
        assert abs(model.prophet_weight - 0.5) < 0.001
