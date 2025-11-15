"""
SARIMA Model for Demand Forecasting

Seasonal AutoRegressive Integrated Moving Average model
for time series forecasting with seasonal patterns
"""
import logging
import pickle
import numpy as np
import pandas as pd
from typing import Dict, Any, Optional, Tuple
from datetime import datetime, timedelta, date
from pathlib import Path

from statsmodels.tsa.statespace.sarimax import SARIMAX
from statsmodels.tsa.stattools import adfuller
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from ..config import settings

logger = logging.getLogger(__name__)


class SARIMAModel:
    """
    SARIMA forecasting model

    Implements Seasonal ARIMA for time series forecasting
    with automatic parameter selection and evaluation
    """

    def __init__(
        self,
        order: Tuple[int, int, int] = None,
        seasonal_order: Tuple[int, int, int, int] = None
    ):
        """
        Initialize SARIMA model

        Args:
            order: (p, d, q) ARIMA order
            seasonal_order: (P, D, Q, s) Seasonal order
        """
        self.logger = logger
        self.order = order or settings.SARIMA_ORDER
        self.seasonal_order = seasonal_order or settings.SARIMA_SEASONAL_ORDER
        self.model = None
        self.model_fit = None
        self.training_data = None
        self.metrics = {}

    def check_stationarity(self, series: pd.Series) -> Dict[str, Any]:
        """
        Check if time series is stationary using Augmented Dickey-Fuller test

        Args:
            series: Time series data

        Returns:
            Stationarity test results
        """
        result = adfuller(series.dropna())

        return {
            'adf_statistic': result[0],
            'p_value': result[1],
            'is_stationary': result[1] < 0.05,  # p-value < 0.05 means stationary
            'critical_values': result[4],
            'interpretation': 'Stationary' if result[1] < 0.05 else 'Non-stationary'
        }

    def auto_select_order(
        self,
        series: pd.Series,
        max_p: int = 3,
        max_d: int = 2,
        max_q: int = 3
    ) -> Tuple[int, int, int]:
        """
        Automatically select best ARIMA order using AIC

        Args:
            series: Time series data
            max_p: Maximum p value to test
            max_d: Maximum d value to test
            max_q: Maximum q value to test

        Returns:
            Best (p, d, q) order
        """
        self.logger.info("Auto-selecting ARIMA order...")

        best_aic = np.inf
        best_order = None

        for p in range(max_p + 1):
            for d in range(max_d + 1):
                for q in range(max_q + 1):
                    try:
                        model = SARIMAX(
                            series,
                            order=(p, d, q),
                            seasonal_order=self.seasonal_order,
                            enforce_stationarity=False,
                            enforce_invertibility=False
                        )
                        results = model.fit(disp=False)

                        if results.aic < best_aic:
                            best_aic = results.aic
                            best_order = (p, d, q)

                    except Exception as e:
                        continue

        self.logger.info(f"Best order: {best_order} with AIC: {best_aic:.2f}")
        return best_order or (1, 1, 1)

    def train(
        self,
        data: pd.DataFrame,
        target_col: str = 'quantity_sold',
        auto_order: bool = False
    ) -> Dict[str, Any]:
        """
        Train SARIMA model

        Args:
            data: Training data with date index
            target_col: Target column name
            auto_order: Automatically select order

        Returns:
            Training summary
        """
        self.logger.info(f"Training SARIMA model with order {self.order}, seasonal {self.seasonal_order}")

        # Ensure data is sorted by date
        if 'sale_date' in data.columns:
            data = data.sort_values('sale_date')
            series = data.set_index('sale_date')[target_col]
        else:
            series = data[target_col]

        # Check stationarity
        stationarity = self.check_stationarity(series)
        self.logger.info(f"Stationarity check: {stationarity['interpretation']} (p-value: {stationarity['p_value']:.4f})")

        # Auto-select order if requested
        if auto_order:
            self.order = self.auto_select_order(series)
            self.logger.info(f"Auto-selected order: {self.order}")

        # Store training data
        self.training_data = series

        try:
            # Create and fit model
            self.model = SARIMAX(
                series,
                order=self.order,
                seasonal_order=self.seasonal_order,
                enforce_stationarity=False,
                enforce_invertibility=False
            )

            self.model_fit = self.model.fit(disp=False, maxiter=200)

            # Calculate in-sample metrics
            predictions = self.model_fit.fittedvalues
            actuals = series

            # Align predictions and actuals (SARIMAX may have different start)
            min_length = min(len(predictions), len(actuals))
            predictions = predictions[-min_length:]
            actuals = actuals[-min_length:]

            self.metrics = self._calculate_metrics(actuals, predictions)

            summary = {
                'success': True,
                'model_type': 'SARIMA',
                'order': self.order,
                'seasonal_order': self.seasonal_order,
                'aic': float(self.model_fit.aic),
                'bic': float(self.model_fit.bic),
                'training_samples': len(series),
                'stationarity': stationarity,
                'metrics': self.metrics,
                'trained_at': datetime.utcnow().isoformat()
            }

            self.logger.info(f"SARIMA training complete: AIC={self.model_fit.aic:.2f}, MAPE={self.metrics['mape']:.2f}%")
            return summary

        except Exception as e:
            self.logger.error(f"SARIMA training failed: {str(e)}", exc_info=True)
            return {
                'success': False,
                'error': str(e),
                'model_type': 'SARIMA'
            }

    def predict(
        self,
        steps: int,
        confidence_level: float = 0.95
    ) -> Dict[str, Any]:
        """
        Generate forecasts

        Args:
            steps: Number of steps to forecast
            confidence_level: Confidence level for intervals

        Returns:
            Forecast results with confidence intervals
        """
        if self.model_fit is None:
            raise ValueError("Model must be trained before making predictions")

        self.logger.info(f"Generating {steps}-step forecast")

        try:
            # Get forecast
            forecast = self.model_fit.get_forecast(steps=steps)

            # Get predictions and confidence intervals
            predictions = forecast.predicted_mean
            conf_int = forecast.conf_int(alpha=1 - confidence_level)

            # Create date range for predictions
            last_date = self.training_data.index[-1]
            if isinstance(last_date, pd.Timestamp):
                last_date = last_date.date()

            forecast_dates = pd.date_range(
                start=last_date + timedelta(days=1),
                periods=steps,
                freq='D'
            )

            # Build result
            forecasts = []
            for i, forecast_date in enumerate(forecast_dates):
                forecasts.append({
                    'forecast_date': forecast_date.date().isoformat(),
                    'predicted_quantity': float(predictions.iloc[i]),
                    'confidence_interval_lower': float(conf_int.iloc[i, 0]),
                    'confidence_interval_upper': float(conf_int.iloc[i, 1]),
                    'confidence_score': confidence_level
                })

            return {
                'success': True,
                'model_type': 'SARIMA',
                'forecasts': forecasts,
                'forecast_horizon': steps,
                'generated_at': datetime.utcnow().isoformat()
            }

        except Exception as e:
            self.logger.error(f"SARIMA prediction failed: {str(e)}", exc_info=True)
            return {
                'success': False,
                'error': str(e),
                'model_type': 'SARIMA'
            }

    def evaluate(
        self,
        test_data: pd.DataFrame,
        target_col: str = 'quantity_sold'
    ) -> Dict[str, Any]:
        """
        Evaluate model on test data

        Args:
            test_data: Test dataset
            target_col: Target column name

        Returns:
            Evaluation metrics
        """
        if self.model_fit is None:
            raise ValueError("Model must be trained before evaluation")

        self.logger.info(f"Evaluating SARIMA model on {len(test_data)} test samples")

        # Prepare test series
        if 'sale_date' in test_data.columns:
            test_data = test_data.sort_values('sale_date')
            test_series = test_data.set_index('sale_date')[target_col]
        else:
            test_series = test_data[target_col]

        # Generate predictions for test period
        steps = len(test_series)
        forecast_result = self.predict(steps=steps)

        if not forecast_result['success']:
            return forecast_result

        # Extract predictions
        predictions = [f['predicted_quantity'] for f in forecast_result['forecasts']]
        actuals = test_series.values

        # Calculate metrics
        metrics = self._calculate_metrics(actuals, predictions)

        return {
            'success': True,
            'model_type': 'SARIMA',
            'test_samples': len(actuals),
            'metrics': metrics,
            'evaluated_at': datetime.utcnow().isoformat()
        }

    def _calculate_metrics(
        self,
        actuals: np.ndarray,
        predictions: np.ndarray
    ) -> Dict[str, float]:
        """
        Calculate evaluation metrics

        Args:
            actuals: Actual values
            predictions: Predicted values

        Returns:
            Dictionary of metrics
        """
        # Ensure same length
        min_length = min(len(actuals), len(predictions))
        actuals = actuals[-min_length:]
        predictions = predictions[-min_length:]

        # MAE - Mean Absolute Error
        mae = mean_absolute_error(actuals, predictions)

        # RMSE - Root Mean Squared Error
        rmse = np.sqrt(mean_squared_error(actuals, predictions))

        # MAPE - Mean Absolute Percentage Error
        # Avoid division by zero
        mask = actuals != 0
        if mask.sum() > 0:
            mape = np.mean(np.abs((actuals[mask] - predictions[mask]) / actuals[mask])) * 100
        else:
            mape = 0.0

        # R² Score
        r2 = r2_score(actuals, predictions)

        return {
            'mae': float(mae),
            'rmse': float(rmse),
            'mape': float(mape),
            'r2_score': float(r2)
        }

    def save(self, filepath: str) -> bool:
        """
        Save trained model to file

        Args:
            filepath: Path to save model

        Returns:
            True if successful
        """
        if self.model_fit is None:
            self.logger.error("No trained model to save")
            return False

        try:
            # Create directory if it doesn't exist
            Path(filepath).parent.mkdir(parents=True, exist_ok=True)

            # Save model
            with open(filepath, 'wb') as f:
                pickle.dump({
                    'model_fit': self.model_fit,
                    'order': self.order,
                    'seasonal_order': self.seasonal_order,
                    'metrics': self.metrics,
                    'training_data': self.training_data
                }, f)

            self.logger.info(f"Model saved to {filepath}")
            return True

        except Exception as e:
            self.logger.error(f"Error saving model: {str(e)}", exc_info=True)
            return False

    def load(self, filepath: str) -> bool:
        """
        Load trained model from file

        Args:
            filepath: Path to model file

        Returns:
            True if successful
        """
        try:
            with open(filepath, 'rb') as f:
                data = pickle.load(f)

            self.model_fit = data['model_fit']
            self.order = data['order']
            self.seasonal_order = data['seasonal_order']
            self.metrics = data['metrics']
            self.training_data = data['training_data']

            self.logger.info(f"Model loaded from {filepath}")
            return True

        except Exception as e:
            self.logger.error(f"Error loading model: {str(e)}", exc_info=True)
            return False

    def get_model_info(self) -> Dict[str, Any]:
        """
        Get model information and parameters

        Returns:
            Model information dictionary
        """
        if self.model_fit is None:
            return {
                'trained': False,
                'message': 'Model not trained yet'
            }

        return {
            'trained': True,
            'model_type': 'SARIMA',
            'order': self.order,
            'seasonal_order': self.seasonal_order,
            'aic': float(self.model_fit.aic),
            'bic': float(self.model_fit.bic),
            'training_samples': len(self.training_data) if self.training_data is not None else 0,
            'metrics': self.metrics
        }
