"""
Ensemble Model for Demand Forecasting

Combines multiple forecasting models (SARIMA, Prophet)
using weighted averaging or stacking for improved accuracy
"""
import logging
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, date
from pathlib import Path

from .sarima_model import SARIMAModel
from .prophet_model import ProphetModel
from ..config import settings

logger = logging.getLogger(__name__)


class EnsembleModel:
    """
    Ensemble forecasting model

    Combines SARIMA and Prophet models using weighted averaging
    to leverage strengths of both approaches for better accuracy
    """

    def __init__(
        self,
        sarima_weight: float = 0.5,
        prophet_weight: float = 0.5,
        auto_weight: bool = True
    ):
        """
        Initialize ensemble model

        Args:
            sarima_weight: Weight for SARIMA model (0-1)
            prophet_weight: Weight for Prophet model (0-1)
            auto_weight: Automatically determine weights based on validation performance
        """
        self.logger = logger
        self.sarima_weight = sarima_weight
        self.prophet_weight = prophet_weight
        self.auto_weight = auto_weight

        self.sarima_model = None
        self.prophet_model = None
        self.training_data = None
        self.metrics = {}

        # Normalize weights
        total_weight = self.sarima_weight + self.prophet_weight
        if total_weight > 0:
            self.sarima_weight /= total_weight
            self.prophet_weight /= total_weight

    def train(
        self,
        data: pd.DataFrame,
        target_col: str = 'quantity_sold',
        validation_split: float = 0.2
    ) -> Dict[str, Any]:
        """
        Train ensemble model by training all component models

        Args:
            data: Training data with date index/column
            target_col: Target column name
            validation_split: Fraction of data to use for validation

        Returns:
            Training summary
        """
        self.logger.info(
            f"Training ensemble model with auto_weight={self.auto_weight}"
        )

        try:
            # Store training data
            self.training_data = data

            # Split data for validation if auto-weighting
            if self.auto_weight and len(data) > 30:
                split_idx = int(len(data) * (1 - validation_split))
                train_data = data.iloc[:split_idx]
                val_data = data.iloc[split_idx:]
            else:
                train_data = data
                val_data = None

            # Train SARIMA model
            self.logger.info("Training SARIMA component...")
            self.sarima_model = SARIMAModel()
            sarima_result = self.sarima_model.train(train_data, target_col=target_col)

            if not sarima_result['success']:
                self.logger.warning(f"SARIMA training failed: {sarima_result.get('error')}")
                sarima_result['metrics'] = {'mape': 100.0}  # Worst case

            # Train Prophet model
            self.logger.info("Training Prophet component...")
            self.prophet_model = ProphetModel()
            prophet_result = self.prophet_model.train(train_data, target_col=target_col)

            if not prophet_result['success']:
                self.logger.warning(f"Prophet training failed: {prophet_result.get('error')}")
                prophet_result['metrics'] = {'mape': 100.0}  # Worst case

            # Auto-determine weights based on validation performance
            if self.auto_weight and val_data is not None:
                self.logger.info("Auto-determining weights from validation performance...")
                weights = self._optimize_weights(val_data, target_col)
                self.sarima_weight = weights['sarima']
                self.prophet_weight = weights['prophet']
                self.logger.info(
                    f"Optimal weights: SARIMA={self.sarima_weight:.3f}, "
                    f"Prophet={self.prophet_weight:.3f}"
                )

            # Calculate ensemble metrics on training data
            self.metrics = {
                'sarima_mape': sarima_result['metrics'].get('mape', 100.0),
                'prophet_mape': prophet_result['metrics'].get('mape', 100.0),
                'sarima_weight': self.sarima_weight,
                'prophet_weight': self.prophet_weight
            }

            summary = {
                'success': True,
                'model_type': 'Ensemble',
                'models': ['SARIMA', 'Prophet'],
                'sarima_weight': self.sarima_weight,
                'prophet_weight': self.prophet_weight,
                'sarima_metrics': sarima_result['metrics'],
                'prophet_metrics': prophet_result['metrics'],
                'training_samples': len(data),
                'auto_weight_used': self.auto_weight,
                'metrics': self.metrics,
                'trained_at': datetime.utcnow().isoformat()
            }

            self.logger.info(
                f"Ensemble training complete: "
                f"SARIMA MAPE={sarima_result['metrics'].get('mape', 0):.2f}%, "
                f"Prophet MAPE={prophet_result['metrics'].get('mape', 0):.2f}%"
            )
            return summary

        except Exception as e:
            self.logger.error(f"Ensemble training failed: {str(e)}", exc_info=True)
            return {
                'success': False,
                'error': str(e),
                'model_type': 'Ensemble'
            }

    def _optimize_weights(
        self,
        val_data: pd.DataFrame,
        target_col: str
    ) -> Dict[str, float]:
        """
        Determine optimal weights based on validation performance

        Args:
            val_data: Validation dataset
            target_col: Target column name

        Returns:
            Dictionary with optimal weights
        """
        try:
            # Evaluate SARIMA on validation data
            sarima_eval = self.sarima_model.evaluate(val_data, target_col=target_col)
            sarima_mape = sarima_eval['metrics'].get('mape', 100.0) if sarima_eval['success'] else 100.0

            # Evaluate Prophet on validation data
            prophet_eval = self.prophet_model.evaluate(val_data, target_col=target_col)
            prophet_mape = prophet_eval['metrics'].get('mape', 100.0) if prophet_eval['success'] else 100.0

            # Inverse MAPE weighting (lower MAPE = higher weight)
            # Add small epsilon to avoid division by zero
            epsilon = 1e-6
            sarima_inv = 1.0 / (sarima_mape + epsilon)
            prophet_inv = 1.0 / (prophet_mape + epsilon)

            total = sarima_inv + prophet_inv

            # Normalize weights
            sarima_weight = sarima_inv / total
            prophet_weight = prophet_inv / total

            self.logger.info(
                f"Validation MAPEs - SARIMA: {sarima_mape:.2f}%, Prophet: {prophet_mape:.2f}%"
            )

            return {
                'sarima': sarima_weight,
                'prophet': prophet_weight
            }

        except Exception as e:
            self.logger.warning(f"Weight optimization failed: {str(e)}, using equal weights")
            return {
                'sarima': 0.5,
                'prophet': 0.5
            }

    def predict(
        self,
        steps: int,
        confidence_level: float = 0.95
    ) -> Dict[str, Any]:
        """
        Generate ensemble forecasts

        Args:
            steps: Number of steps to forecast
            confidence_level: Confidence level for intervals

        Returns:
            Forecast results with confidence intervals
        """
        if self.sarima_model is None or self.prophet_model is None:
            raise ValueError("Models must be trained before making predictions")

        self.logger.info(f"Generating {steps}-step ensemble forecast")

        try:
            # Get SARIMA predictions
            sarima_result = self.sarima_model.predict(steps, confidence_level)
            if not sarima_result['success']:
                self.logger.warning(f"SARIMA prediction failed: {sarima_result.get('error')}")
                sarima_forecasts = None
            else:
                sarima_forecasts = sarima_result['forecasts']

            # Get Prophet predictions
            prophet_result = self.prophet_model.predict(steps, confidence_level)
            if not prophet_result['success']:
                self.logger.warning(f"Prophet prediction failed: {prophet_result.get('error')}")
                prophet_forecasts = None
            else:
                prophet_forecasts = prophet_result['forecasts']

            # Combine forecasts
            if sarima_forecasts is None and prophet_forecasts is None:
                return {
                    'success': False,
                    'error': 'Both models failed to generate predictions',
                    'model_type': 'Ensemble'
                }

            # Use available model if one failed
            if sarima_forecasts is None:
                self.logger.warning("Using only Prophet predictions")
                return prophet_result

            if prophet_forecasts is None:
                self.logger.warning("Using only SARIMA predictions")
                return sarima_result

            # Weighted ensemble
            ensemble_forecasts = []
            for i in range(len(sarima_forecasts)):
                sarima = sarima_forecasts[i]
                prophet = prophet_forecasts[i]

                # Weighted average of predictions
                ensemble_pred = (
                    self.sarima_weight * sarima['predicted_quantity'] +
                    self.prophet_weight * prophet['predicted_quantity']
                )

                # Weighted average of confidence intervals
                ensemble_lower = (
                    self.sarima_weight * sarima['confidence_interval_lower'] +
                    self.prophet_weight * prophet['confidence_interval_lower']
                )

                ensemble_upper = (
                    self.sarima_weight * sarima['confidence_interval_upper'] +
                    self.prophet_weight * prophet['confidence_interval_upper']
                )

                ensemble_forecasts.append({
                    'forecast_date': sarima['forecast_date'],
                    'predicted_quantity': float(max(0, ensemble_pred)),
                    'confidence_interval_lower': float(max(0, ensemble_lower)),
                    'confidence_interval_upper': float(max(0, ensemble_upper)),
                    'confidence_score': confidence_level,
                    'sarima_prediction': sarima['predicted_quantity'],
                    'prophet_prediction': prophet['predicted_quantity'],
                    'ensemble_weights': {
                        'sarima': self.sarima_weight,
                        'prophet': self.prophet_weight
                    }
                })

            return {
                'success': True,
                'model_type': 'Ensemble',
                'forecasts': ensemble_forecasts,
                'forecast_horizon': steps,
                'component_models': ['SARIMA', 'Prophet'],
                'weights': {
                    'sarima': self.sarima_weight,
                    'prophet': self.prophet_weight
                },
                'generated_at': datetime.utcnow().isoformat()
            }

        except Exception as e:
            self.logger.error(f"Ensemble prediction failed: {str(e)}", exc_info=True)
            return {
                'success': False,
                'error': str(e),
                'model_type': 'Ensemble'
            }

    def evaluate(
        self,
        test_data: pd.DataFrame,
        target_col: str = 'quantity_sold'
    ) -> Dict[str, Any]:
        """
        Evaluate ensemble model on test data

        Args:
            test_data: Test dataset
            target_col: Target column name

        Returns:
            Evaluation metrics
        """
        if self.sarima_model is None or self.prophet_model is None:
            raise ValueError("Models must be trained before evaluation")

        self.logger.info(f"Evaluating ensemble model on {len(test_data)} test samples")

        try:
            # Evaluate SARIMA
            sarima_eval = self.sarima_model.evaluate(test_data, target_col=target_col)

            # Evaluate Prophet
            prophet_eval = self.prophet_model.evaluate(test_data, target_col=target_col)

            # Generate ensemble predictions
            steps = len(test_data)
            ensemble_result = self.predict(steps=steps)

            if not ensemble_result['success']:
                return ensemble_result

            # Extract predictions
            predictions = [f['predicted_quantity'] for f in ensemble_result['forecasts']]

            # Get actuals
            if 'sale_date' in test_data.columns:
                test_data = test_data.sort_values('sale_date')
            actuals = test_data[target_col].values

            # Calculate metrics
            from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

            mae = mean_absolute_error(actuals, predictions)
            rmse = np.sqrt(mean_squared_error(actuals, predictions))

            # MAPE
            mask = actuals != 0
            if mask.sum() > 0:
                mape = np.mean(np.abs((actuals[mask] - predictions[mask]) / actuals[mask])) * 100
            else:
                mape = 0.0

            r2 = r2_score(actuals, predictions)

            ensemble_metrics = {
                'mae': float(mae),
                'rmse': float(rmse),
                'mape': float(mape),
                'r2_score': float(r2)
            }

            return {
                'success': True,
                'model_type': 'Ensemble',
                'test_samples': len(actuals),
                'metrics': ensemble_metrics,
                'sarima_metrics': sarima_eval['metrics'] if sarima_eval['success'] else {},
                'prophet_metrics': prophet_eval['metrics'] if prophet_eval['success'] else {},
                'weights': {
                    'sarima': self.sarima_weight,
                    'prophet': self.prophet_weight
                },
                'evaluated_at': datetime.utcnow().isoformat()
            }

        except Exception as e:
            self.logger.error(f"Ensemble evaluation failed: {str(e)}", exc_info=True)
            return {
                'success': False,
                'error': str(e),
                'model_type': 'Ensemble'
            }

    def get_model_info(self) -> Dict[str, Any]:
        """
        Get ensemble model information

        Returns:
            Model information dictionary
        """
        if self.sarima_model is None or self.prophet_model is None:
            return {
                'trained': False,
                'message': 'Models not trained yet'
            }

        return {
            'trained': True,
            'model_type': 'Ensemble',
            'component_models': ['SARIMA', 'Prophet'],
            'weights': {
                'sarima': self.sarima_weight,
                'prophet': self.prophet_weight
            },
            'auto_weight_used': self.auto_weight,
            'sarima_info': self.sarima_model.get_model_info(),
            'prophet_info': self.prophet_model.get_model_info(),
            'metrics': self.metrics
        }
