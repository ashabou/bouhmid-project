"""
Prophet Model for Demand Forecasting

Facebook Prophet model for time series forecasting
with automatic seasonality detection and holiday effects
"""
import logging
import pickle
import numpy as np
import pandas as pd
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta, date
from pathlib import Path

from prophet import Prophet
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from ..config import settings

logger = logging.getLogger(__name__)


class ProphetModel:
    """
    Prophet forecasting model

    Implements Facebook Prophet for time series forecasting
    with automatic seasonality detection and trend analysis
    """

    def __init__(
        self,
        yearly_seasonality: bool = True,
        weekly_seasonality: bool = True,
        daily_seasonality: bool = False,
        changepoint_prior_scale: float = 0.05
    ):
        """
        Initialize Prophet model

        Args:
            yearly_seasonality: Enable yearly seasonality
            weekly_seasonality: Enable weekly seasonality
            daily_seasonality: Enable daily seasonality
            changepoint_prior_scale: Flexibility of trend (higher = more flexible)
        """
        self.logger = logger
        self.yearly_seasonality = yearly_seasonality
        self.weekly_seasonality = weekly_seasonality
        self.daily_seasonality = daily_seasonality
        self.changepoint_prior_scale = changepoint_prior_scale

        self.model = None
        self.training_data = None
        self.metrics = {}

    def _prepare_prophet_df(
        self,
        data: pd.DataFrame,
        date_col: str = 'sale_date',
        target_col: str = 'quantity_sold'
    ) -> pd.DataFrame:
        """
        Prepare data for Prophet format (ds, y columns)

        Args:
            data: Input dataframe
            date_col: Date column name
            target_col: Target column name

        Returns:
            DataFrame in Prophet format
        """
        df = data.copy()

        # Ensure date column exists
        if date_col not in df.columns:
            if df.index.name == date_col or isinstance(df.index, pd.DatetimeIndex):
                df = df.reset_index()
            else:
                raise ValueError(f"Date column '{date_col}' not found")

        # Prophet requires 'ds' (date) and 'y' (target) columns
        prophet_df = pd.DataFrame({
            'ds': pd.to_datetime(df[date_col]),
            'y': df[target_col]
        })

        return prophet_df

    def train(
        self,
        data: pd.DataFrame,
        target_col: str = 'quantity_sold',
        date_col: str = 'sale_date'
    ) -> Dict[str, Any]:
        """
        Train Prophet model

        Args:
            data: Training data with date column
            target_col: Target column name
            date_col: Date column name

        Returns:
            Training summary
        """
        self.logger.info(
            f"Training Prophet model with "
            f"yearly_seasonality={self.yearly_seasonality}, "
            f"weekly_seasonality={self.weekly_seasonality}"
        )

        try:
            # Prepare data for Prophet
            prophet_df = self._prepare_prophet_df(data, date_col, target_col)

            # Store training data
            self.training_data = prophet_df

            # Create and configure Prophet model
            self.model = Prophet(
                yearly_seasonality=self.yearly_seasonality,
                weekly_seasonality=self.weekly_seasonality,
                daily_seasonality=self.daily_seasonality,
                changepoint_prior_scale=self.changepoint_prior_scale,
                interval_width=settings.CONFIDENCE_LEVEL
            )

            # Suppress Prophet's verbose output
            import warnings
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                self.model.fit(prophet_df)

            # Generate in-sample predictions for metrics
            predictions = self.model.predict(prophet_df)

            # Calculate in-sample metrics
            actuals = prophet_df['y'].values
            predicted = predictions['yhat'].values

            self.metrics = self._calculate_metrics(actuals, predicted)

            summary = {
                'success': True,
                'model_type': 'Prophet',
                'yearly_seasonality': self.yearly_seasonality,
                'weekly_seasonality': self.weekly_seasonality,
                'daily_seasonality': self.daily_seasonality,
                'changepoint_prior_scale': self.changepoint_prior_scale,
                'training_samples': len(prophet_df),
                'metrics': self.metrics,
                'trained_at': datetime.utcnow().isoformat()
            }

            self.logger.info(
                f"Prophet training complete: MAPE={self.metrics['mape']:.2f}%"
            )
            return summary

        except Exception as e:
            self.logger.error(f"Prophet training failed: {str(e)}", exc_info=True)
            return {
                'success': False,
                'error': str(e),
                'model_type': 'Prophet'
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
        if self.model is None:
            raise ValueError("Model must be trained before making predictions")

        self.logger.info(f"Generating {steps}-step forecast")

        try:
            # Create future dataframe
            future = self.model.make_future_dataframe(periods=steps, freq='D')

            # Generate forecast
            forecast = self.model.predict(future)

            # Extract only future predictions (not in-sample)
            last_date = self.training_data['ds'].max()
            future_forecast = forecast[forecast['ds'] > last_date].head(steps)

            # Build result
            forecasts = []
            for _, row in future_forecast.iterrows():
                forecasts.append({
                    'forecast_date': row['ds'].date().isoformat(),
                    'predicted_quantity': float(max(0, row['yhat'])),  # Ensure non-negative
                    'confidence_interval_lower': float(max(0, row['yhat_lower'])),
                    'confidence_interval_upper': float(max(0, row['yhat_upper'])),
                    'confidence_score': confidence_level,
                    'trend': float(row.get('trend', 0)),
                    'seasonal': float(row.get('yearly', 0) + row.get('weekly', 0))
                })

            return {
                'success': True,
                'model_type': 'Prophet',
                'forecasts': forecasts,
                'forecast_horizon': steps,
                'generated_at': datetime.utcnow().isoformat()
            }

        except Exception as e:
            self.logger.error(f"Prophet prediction failed: {str(e)}", exc_info=True)
            return {
                'success': False,
                'error': str(e),
                'model_type': 'Prophet'
            }

    def evaluate(
        self,
        test_data: pd.DataFrame,
        target_col: str = 'quantity_sold',
        date_col: str = 'sale_date'
    ) -> Dict[str, Any]:
        """
        Evaluate model on test data

        Args:
            test_data: Test dataset
            target_col: Target column name
            date_col: Date column name

        Returns:
            Evaluation metrics
        """
        if self.model is None:
            raise ValueError("Model must be trained before evaluation")

        self.logger.info(f"Evaluating Prophet model on {len(test_data)} test samples")

        try:
            # Prepare test data
            test_df = self._prepare_prophet_df(test_data, date_col, target_col)

            # Generate predictions for test period
            predictions = self.model.predict(test_df)

            # Extract predictions
            predicted = predictions['yhat'].values
            actuals = test_df['y'].values

            # Ensure non-negative predictions
            predicted = np.maximum(predicted, 0)

            # Calculate metrics
            metrics = self._calculate_metrics(actuals, predicted)

            return {
                'success': True,
                'model_type': 'Prophet',
                'test_samples': len(actuals),
                'metrics': metrics,
                'evaluated_at': datetime.utcnow().isoformat()
            }

        except Exception as e:
            self.logger.error(f"Prophet evaluation failed: {str(e)}", exc_info=True)
            return {
                'success': False,
                'error': str(e),
                'model_type': 'Prophet'
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

        # Ensure non-negative predictions
        predictions = np.maximum(predictions, 0)

        # MAE - Mean Absolute Error
        mae = mean_absolute_error(actuals, predictions)

        # RMSE - Root Mean Squared Error
        rmse = np.sqrt(mean_squared_error(actuals, predictions))

        # MAPE - Mean Absolute Percentage Error
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

    def get_seasonality_components(self) -> Optional[Dict[str, Any]]:
        """
        Get decomposed seasonality components

        Returns:
            Seasonality components (trend, yearly, weekly)
        """
        if self.model is None:
            return None

        try:
            # Get the latest forecast with components
            future = self.model.make_future_dataframe(periods=0)
            forecast = self.model.predict(future)

            components = {
                'trend': forecast['trend'].tolist(),
                'dates': forecast['ds'].dt.strftime('%Y-%m-%d').tolist()
            }

            # Add seasonal components if available
            if 'yearly' in forecast.columns:
                components['yearly'] = forecast['yearly'].tolist()
            if 'weekly' in forecast.columns:
                components['weekly'] = forecast['weekly'].tolist()

            return components

        except Exception as e:
            self.logger.error(f"Error extracting components: {str(e)}")
            return None

    def save(self, filepath: str) -> bool:
        """
        Save trained model to file

        Args:
            filepath: Path to save model

        Returns:
            True if successful
        """
        if self.model is None:
            self.logger.error("No trained model to save")
            return False

        try:
            # Create directory if it doesn't exist
            Path(filepath).parent.mkdir(parents=True, exist_ok=True)

            # Save model
            with open(filepath, 'wb') as f:
                pickle.dump({
                    'model': self.model,
                    'yearly_seasonality': self.yearly_seasonality,
                    'weekly_seasonality': self.weekly_seasonality,
                    'daily_seasonality': self.daily_seasonality,
                    'changepoint_prior_scale': self.changepoint_prior_scale,
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

            self.model = data['model']
            self.yearly_seasonality = data['yearly_seasonality']
            self.weekly_seasonality = data['weekly_seasonality']
            self.daily_seasonality = data['daily_seasonality']
            self.changepoint_prior_scale = data['changepoint_prior_scale']
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
        if self.model is None:
            return {
                'trained': False,
                'message': 'Model not trained yet'
            }

        return {
            'trained': True,
            'model_type': 'Prophet',
            'yearly_seasonality': self.yearly_seasonality,
            'weekly_seasonality': self.weekly_seasonality,
            'daily_seasonality': self.daily_seasonality,
            'changepoint_prior_scale': self.changepoint_prior_scale,
            'training_samples': len(self.training_data) if self.training_data is not None else 0,
            'metrics': self.metrics
        }
