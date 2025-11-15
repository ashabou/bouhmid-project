"""
Forecasting Service

Main service for generating and managing demand forecasts
Coordinates feature engineering, model training, and prediction
"""
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
import pandas as pd

from ..models import Forecast, SalesHistory
from ..models.schemas import ForecastCreate
from .feature_engineering import FeatureEngineer
from .sarima_model import SARIMAModel
from .prophet_model import ProphetModel
from .ensemble_model import EnsembleModel
from ..config import settings

logger = logging.getLogger(__name__)


class Forecaster:
    """
    Main forecasting service

    Orchestrates the forecasting pipeline:
    1. Feature engineering
    2. Model training
    3. Prediction generation
    4. Forecast storage
    """

    def __init__(self):
        """Initialize forecaster"""
        self.logger = logger
        self.feature_engineer = FeatureEngineer()

    def generate_forecast(
        self,
        product_id: Optional[str] = None,
        sku: Optional[str] = None,
        category_id: Optional[int] = None,
        forecast_horizon_days: int = 30,
        model_name: str = "SARIMA",
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Generate forecast for product/SKU/category

        Args:
            product_id: Product ID to forecast
            sku: SKU to forecast
            category_id: Category ID to forecast
            forecast_horizon_days: Number of days to forecast
            model_name: Model to use (SARIMA, Prophet, Ensemble)
            db: Database session

        Returns:
            Forecast generation results
        """
        self.logger.info(
            f"Generating {forecast_horizon_days}-day forecast for "
            f"product_id={product_id}, sku={sku}, category_id={category_id} "
            f"using {model_name}"
        )

        try:
            # Step 1: Prepare features
            df = self.feature_engineer.prepare_time_series(
                product_id=product_id,
                sku=sku,
                category_id=category_id,
                db=db
            )

            if df.empty:
                return {
                    'success': False,
                    'error': 'No historical data available',
                    'forecasts_created': 0
                }

            # Check minimum data requirement
            if len(df) < settings.MIN_HISTORY_DAYS:
                return {
                    'success': False,
                    'error': f'Insufficient data: {len(df)} days available, {settings.MIN_HISTORY_DAYS} required',
                    'forecasts_created': 0
                }

            # Step 2: Split data (80% train, 20% validation)
            train_df, val_df = self.feature_engineer.split_train_test(df, test_size=0.2)

            # Step 3: Train model
            if model_name == "SARIMA":
                model = SARIMAModel()
                training_result = model.train(train_df, target_col='quantity_sold')

                if not training_result['success']:
                    return {
                        'success': False,
                        'error': training_result.get('error', 'Training failed'),
                        'forecasts_created': 0
                    }

                # Step 4: Evaluate on validation set
                eval_result = model.evaluate(val_df, target_col='quantity_sold')
                self.logger.info(f"Model evaluation: MAPE={eval_result['metrics']['mape']:.2f}%")

                # Step 5: Generate forecast
                forecast_result = model.predict(
                    steps=forecast_horizon_days,
                    confidence_level=settings.CONFIDENCE_LEVEL
                )

                if not forecast_result['success']:
                    return {
                        'success': False,
                        'error': forecast_result.get('error', 'Prediction failed'),
                        'forecasts_created': 0
                    }

                # Step 6: Store forecasts in database
                forecasts_created = self._store_forecasts(
                    forecasts=forecast_result['forecasts'],
                    product_id=product_id,
                    sku=sku,
                    model_name=model_name,
                    model_version="1.0",
                    training_result=training_result,
                    db=db
                )

                return {
                    'success': True,
                    'forecasts_created': forecasts_created,
                    'model_type': model_name,
                    'forecast_horizon_days': forecast_horizon_days,
                    'training_metrics': training_result['metrics'],
                    'validation_metrics': eval_result['metrics'],
                    'model_info': model.get_model_info()
                }

            elif model_name == "Prophet":
                model = ProphetModel()
                training_result = model.train(train_df, target_col='quantity_sold')

                if not training_result['success']:
                    return {
                        'success': False,
                        'error': training_result.get('error', 'Training failed'),
                        'forecasts_created': 0
                    }

                # Step 4: Evaluate on validation set
                eval_result = model.evaluate(val_df, target_col='quantity_sold')
                self.logger.info(f"Model evaluation: MAPE={eval_result['metrics']['mape']:.2f}%")

                # Step 5: Generate forecast
                forecast_result = model.predict(
                    steps=forecast_horizon_days,
                    confidence_level=settings.CONFIDENCE_LEVEL
                )

                if not forecast_result['success']:
                    return {
                        'success': False,
                        'error': forecast_result.get('error', 'Prediction failed'),
                        'forecasts_created': 0
                    }

                # Step 6: Store forecasts in database
                forecasts_created = self._store_forecasts(
                    forecasts=forecast_result['forecasts'],
                    product_id=product_id,
                    sku=sku,
                    model_name=model_name,
                    model_version="1.0",
                    training_result=training_result,
                    db=db
                )

                return {
                    'success': True,
                    'forecasts_created': forecasts_created,
                    'model_type': model_name,
                    'forecast_horizon_days': forecast_horizon_days,
                    'training_metrics': training_result['metrics'],
                    'validation_metrics': eval_result['metrics'],
                    'model_info': model.get_model_info()
                }

            elif model_name == "Ensemble":
                model = EnsembleModel(auto_weight=True)
                training_result = model.train(df, target_col='quantity_sold', validation_split=0.2)

                if not training_result['success']:
                    return {
                        'success': False,
                        'error': training_result.get('error', 'Training failed'),
                        'forecasts_created': 0
                    }

                # Step 4: Evaluate on validation set
                eval_result = model.evaluate(val_df, target_col='quantity_sold')
                self.logger.info(f"Model evaluation: MAPE={eval_result['metrics']['mape']:.2f}%")

                # Step 5: Generate forecast
                forecast_result = model.predict(
                    steps=forecast_horizon_days,
                    confidence_level=settings.CONFIDENCE_LEVEL
                )

                if not forecast_result['success']:
                    return {
                        'success': False,
                        'error': forecast_result.get('error', 'Prediction failed'),
                        'forecasts_created': 0
                    }

                # Step 6: Store forecasts in database
                forecasts_created = self._store_forecasts(
                    forecasts=forecast_result['forecasts'],
                    product_id=product_id,
                    sku=sku,
                    model_name=model_name,
                    model_version="1.0",
                    training_result=training_result,
                    db=db
                )

                return {
                    'success': True,
                    'forecasts_created': forecasts_created,
                    'model_type': model_name,
                    'forecast_horizon_days': forecast_horizon_days,
                    'training_metrics': training_result.get('metrics', {}),
                    'validation_metrics': eval_result['metrics'],
                    'model_info': model.get_model_info()
                }

            else:
                return {
                    'success': False,
                    'error': f'Model {model_name} not supported. Choose from: SARIMA, Prophet, Ensemble',
                    'forecasts_created': 0
                }

        except Exception as e:
            self.logger.error(f"Error generating forecast: {str(e)}", exc_info=True)
            return {
                'success': False,
                'error': str(e),
                'forecasts_created': 0
            }

    def _store_forecasts(
        self,
        forecasts: List[Dict[str, Any]],
        product_id: Optional[str],
        sku: Optional[str],
        model_name: str,
        model_version: str,
        training_result: Dict[str, Any],
        db: Session
    ) -> int:
        """
        Store forecasts in database

        Args:
            forecasts: List of forecast dictionaries
            product_id: Product ID
            sku: SKU
            model_name: Model name
            model_version: Model version
            training_result: Training results
            db: Database session

        Returns:
            Number of forecasts created
        """
        created = 0

        # Determine forecast horizon label
        num_forecasts = len(forecasts)
        if num_forecasts <= 7:
            horizon = "7-day"
        elif num_forecasts <= 14:
            horizon = "14-day"
        elif num_forecasts <= 30:
            horizon = "30-day"
        else:
            horizon = f"{num_forecasts}-day"

        for forecast_data in forecasts:
            try:
                # Check if forecast already exists
                existing = db.query(Forecast).filter(
                    Forecast.product_id == product_id,
                    Forecast.forecast_date == forecast_data['forecast_date'],
                    Forecast.forecast_horizon == horizon
                ).first()

                if existing:
                    # Update existing forecast
                    existing.predicted_quantity = forecast_data['predicted_quantity']
                    existing.confidence_interval_lower = forecast_data['confidence_interval_lower']
                    existing.confidence_interval_upper = forecast_data['confidence_interval_upper']
                    existing.confidence_score = forecast_data['confidence_score']
                    existing.model_name = model_name
                    existing.model_version = model_version
                    existing.features_used = training_result.get('metrics', {})
                    existing.generated_at = datetime.utcnow()
                else:
                    # Create new forecast
                    forecast = Forecast(
                        product_id=product_id or "00000000-0000-0000-0000-000000000000",
                        sku=sku or "UNKNOWN",
                        forecast_date=forecast_data['forecast_date'],
                        forecast_horizon=horizon,
                        predicted_quantity=forecast_data['predicted_quantity'],
                        confidence_interval_lower=forecast_data['confidence_interval_lower'],
                        confidence_interval_upper=forecast_data['confidence_interval_upper'],
                        confidence_score=forecast_data['confidence_score'],
                        model_name=model_name,
                        model_version=model_version,
                        features_used=training_result.get('metrics', {})
                    )
                    db.add(forecast)

                created += 1

            except Exception as e:
                self.logger.error(f"Error storing forecast: {str(e)}", exc_info=True)
                continue

        db.commit()
        self.logger.info(f"Stored {created} forecasts")
        return created

    def update_forecast_actuals(
        self,
        forecast_date: date,
        db: Session
    ) -> Dict[str, Any]:
        """
        Update forecasts with actual values for evaluation

        Args:
            forecast_date: Date to update
            db: Database session

        Returns:
            Update summary
        """
        self.logger.info(f"Updating forecast actuals for {forecast_date}")

        try:
            # Get forecasts for this date
            forecasts = db.query(Forecast).filter(
                Forecast.forecast_date == forecast_date,
                Forecast.actual_quantity.is_(None)  # Only update if not already updated
            ).all()

            updated = 0

            for forecast in forecasts:
                # Get actual sales for this product/date
                actual = db.query(SalesHistory).filter(
                    SalesHistory.product_id == forecast.product_id,
                    SalesHistory.sale_date == forecast_date
                ).first()

                if actual:
                    # Update forecast with actual
                    forecast.actual_quantity = actual.quantity_sold
                    forecast.calculate_error()  # Calculate prediction error
                    updated += 1

            db.commit()

            return {
                'success': True,
                'forecasts_checked': len(forecasts),
                'forecasts_updated': updated,
                'date': forecast_date.isoformat()
            }

        except Exception as e:
            db.rollback()
            self.logger.error(f"Error updating forecast actuals: {str(e)}", exc_info=True)
            return {
                'success': False,
                'error': str(e)
            }

    def get_accuracy_report(
        self,
        start_date: date,
        end_date: date,
        db: Session
    ) -> Dict[str, Any]:
        """
        Generate forecast accuracy report

        Args:
            start_date: Report start date
            end_date: Report end date
            db: Database session

        Returns:
            Accuracy report
        """
        self.logger.info(f"Generating accuracy report for {start_date} to {end_date}")

        try:
            # Get forecasts with actuals
            forecasts = db.query(Forecast).filter(
                Forecast.forecast_date >= start_date,
                Forecast.forecast_date <= end_date,
                Forecast.actual_quantity.isnot(None)
            ).all()

            if not forecasts:
                return {
                    'success': False,
                    'error': 'No forecasts with actual values found',
                    'total_forecasts': 0
                }

            # Calculate metrics by model
            model_metrics = {}
            all_errors = []
            all_mapes = []

            for forecast in forecasts:
                model_name = forecast.model_name or 'Unknown'

                if model_name not in model_metrics:
                    model_metrics[model_name] = {
                        'errors': [],
                        'mapes': [],
                        'count': 0
                    }

                error = float(forecast.error) if forecast.error else 0
                mape = forecast.get_mape()

                model_metrics[model_name]['errors'].append(error)
                if mape is not None:
                    model_metrics[model_name]['mapes'].append(mape)
                model_metrics[model_name]['count'] += 1

                all_errors.append(error)
                if mape is not None:
                    all_mapes.append(mape)

            # Calculate summary statistics
            models = []
            for model_name, metrics in model_metrics.items():
                mae = sum(metrics['errors']) / len(metrics['errors'])
                rmse = (sum([e**2 for e in metrics['errors']]) / len(metrics['errors'])) ** 0.5
                mape = sum(metrics['mapes']) / len(metrics['mapes']) if metrics['mapes'] else 0

                models.append({
                    'model_name': model_name,
                    'mae': round(mae, 2),
                    'rmse': round(rmse, 2),
                    'mape': round(mape, 2),
                    'samples_evaluated': metrics['count'],
                    'last_updated': datetime.utcnow().isoformat()
                })

            # Overall metrics
            overall_mae = sum(all_errors) / len(all_errors)
            overall_mape = sum(all_mapes) / len(all_mapes) if all_mapes else 0

            return {
                'success': True,
                'period_start': start_date.isoformat(),
                'period_end': end_date.isoformat(),
                'models': models,
                'overall_mae': round(overall_mae, 2),
                'overall_mape': round(overall_mape, 2),
                'total_forecasts': len(forecasts),
                'forecasts_with_actuals': len(forecasts)
            }

        except Exception as e:
            self.logger.error(f"Error generating accuracy report: {str(e)}", exc_info=True)
            return {
                'success': False,
                'error': str(e)
            }
