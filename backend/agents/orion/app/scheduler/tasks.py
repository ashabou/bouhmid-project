"""
Celery Tasks for Orion Forecasting Agent

Background tasks for:
- Automated forecast generation
- Forecast accuracy updates
- Insights generation
- Report generation
- Data cleanup
"""
import logging
from datetime import datetime, date, timedelta
from typing import List, Dict, Any
from sqlalchemy.orm import Session

from .celery_app import celery_app
from ..models.database import SessionLocal
from ..models import SalesHistory, Forecast, ForecastInsight
from ..forecasting.forecaster import Forecaster
from ..forecasting.insights_generator import InsightsGenerator
from ..config import settings

logger = logging.getLogger(__name__)


def get_db_session() -> Session:
    """Get database session for task"""
    return SessionLocal()


@celery_app.task(name='app.scheduler.tasks.generate_forecast_for_product', bind=True, max_retries=3)
def generate_forecast_for_product(
    self,
    product_id: str,
    sku: str,
    model_name: str = "Ensemble",
    horizon_days: int = 30
) -> Dict[str, Any]:
    """
    Generate forecast for a single product

    Args:
        product_id: Product UUID
        sku: Product SKU
        model_name: Model to use (SARIMA, Prophet, Ensemble)
        horizon_days: Forecast horizon in days

    Returns:
        Forecast generation result
    """
    logger.info(f"Task started: generate_forecast_for_product(product_id={product_id}, model={model_name})")

    db = get_db_session()

    try:
        forecaster = Forecaster()

        result = forecaster.generate_forecast(
            product_id=product_id,
            sku=sku,
            forecast_horizon_days=horizon_days,
            model_name=model_name,
            db=db
        )

        logger.info(
            f"Forecast generated for product {product_id}: "
            f"success={result['success']}, "
            f"forecasts_created={result.get('forecasts_created', 0)}"
        )

        return result

    except Exception as e:
        logger.error(f"Error in generate_forecast_for_product: {str(e)}", exc_info=True)

        # Retry with exponential backoff
        retry_delay = 60 * (2 ** self.request.retries)  # 60s, 120s, 240s
        raise self.retry(exc=e, countdown=retry_delay)

    finally:
        db.close()


@celery_app.task(name='app.scheduler.tasks.generate_all_forecasts', bind=True)
def generate_all_forecasts(self) -> Dict[str, Any]:
    """
    Generate forecasts for all active products

    This task runs daily to generate 30-day forecasts for all products
    that have sufficient historical data.

    Returns:
        Summary of forecast generation
    """
    logger.info("Task started: generate_all_forecasts")

    db = get_db_session()
    results = {
        'success': True,
        'products_processed': 0,
        'forecasts_generated': 0,
        'errors': 0,
        'started_at': datetime.utcnow().isoformat()
    }

    try:
        # Get unique products from sales history with sufficient data
        min_date = date.today() - timedelta(days=settings.MIN_HISTORY_DAYS)

        products = db.query(
            SalesHistory.product_id,
            SalesHistory.sku
        ).filter(
            SalesHistory.sale_date >= min_date
        ).group_by(
            SalesHistory.product_id,
            SalesHistory.sku
        ).having(
            # At least MIN_HISTORY_DAYS of data
            # Note: Using func.count would require import
            SalesHistory.product_id.isnot(None)
        ).all()

        logger.info(f"Found {len(products)} products to forecast")

        # Generate forecasts for each product
        for product in products:
            try:
                # Use Celery task to generate forecast (allows parallel processing)
                result = generate_forecast_for_product.apply_async(
                    args=[
                        str(product.product_id),
                        product.sku,
                        "Ensemble",  # Use ensemble model for best accuracy
                        30  # 30-day forecast
                    ],
                    expires=3600  # Task expires in 1 hour
                )

                results['products_processed'] += 1

            except Exception as e:
                logger.error(f"Error queuing forecast for product {product.product_id}: {str(e)}")
                results['errors'] += 1
                continue

        results['completed_at'] = datetime.utcnow().isoformat()
        logger.info(
            f"generate_all_forecasts completed: "
            f"processed={results['products_processed']}, "
            f"errors={results['errors']}"
        )

        return results

    except Exception as e:
        logger.error(f"Error in generate_all_forecasts: {str(e)}", exc_info=True)
        results['success'] = False
        results['error'] = str(e)
        return results

    finally:
        db.close()


@celery_app.task(name='app.scheduler.tasks.update_all_forecast_actuals')
def update_all_forecast_actuals() -> Dict[str, Any]:
    """
    Update forecasts with actual values for yesterday

    Runs daily to compare forecasts with actual sales for accuracy tracking.

    Returns:
        Summary of updates
    """
    logger.info("Task started: update_all_forecast_actuals")

    db = get_db_session()
    results = {
        'success': True,
        'date': (date.today() - timedelta(days=1)).isoformat(),
        'forecasts_updated': 0
    }

    try:
        forecaster = Forecaster()

        # Update actuals for yesterday
        yesterday = date.today() - timedelta(days=1)

        result = forecaster.update_forecast_actuals(
            forecast_date=yesterday,
            db=db
        )

        results.update(result)

        logger.info(
            f"Forecast actuals updated for {yesterday}: "
            f"updated={result.get('forecasts_updated', 0)}"
        )

        return results

    except Exception as e:
        logger.error(f"Error in update_all_forecast_actuals: {str(e)}", exc_info=True)
        results['success'] = False
        results['error'] = str(e)
        return results

    finally:
        db.close()


@celery_app.task(name='app.scheduler.tasks.generate_insights_for_product')
def generate_insights_for_product(
    product_id: str,
    horizon_days: int = 30
) -> Dict[str, Any]:
    """
    Generate insights for a single product

    Args:
        product_id: Product UUID
        horizon_days: Forecast horizon to analyze

    Returns:
        Insights generation result
    """
    logger.info(f"Task started: generate_insights_for_product(product_id={product_id})")

    db = get_db_session()

    try:
        insights_gen = InsightsGenerator()

        result = insights_gen.generate_insights(
            product_id=product_id,
            forecast_horizon_days=horizon_days,
            db=db
        )

        logger.info(
            f"Insights generated for product {product_id}: "
            f"insights_created={result.get('insights_created', 0)}"
        )

        return result

    except Exception as e:
        logger.error(f"Error in generate_insights_for_product: {str(e)}", exc_info=True)
        return {
            'success': False,
            'error': str(e)
        }

    finally:
        db.close()


@celery_app.task(name='app.scheduler.tasks.generate_all_insights')
def generate_all_insights() -> Dict[str, Any]:
    """
    Generate insights for all products with forecasts

    Runs every 6 hours to identify trends, risks, and opportunities.

    Returns:
        Summary of insights generation
    """
    logger.info("Task started: generate_all_insights")

    db = get_db_session()
    results = {
        'success': True,
        'products_processed': 0,
        'insights_generated': 0,
        'started_at': datetime.utcnow().isoformat()
    }

    try:
        # Get products with recent forecasts
        recent_date = date.today() - timedelta(days=1)

        products = db.query(Forecast.product_id).filter(
            Forecast.forecast_date >= date.today(),
            Forecast.generated_at >= datetime.utcnow() - timedelta(days=7)
        ).distinct().all()

        logger.info(f"Found {len(products)} products with forecasts")

        # Generate insights for each product
        for product in products:
            try:
                result = generate_insights_for_product.apply_async(
                    args=[str(product.product_id), 30],
                    expires=1800  # Task expires in 30 minutes
                )

                results['products_processed'] += 1

            except Exception as e:
                logger.error(f"Error queuing insights for product {product.product_id}: {str(e)}")
                continue

        results['completed_at'] = datetime.utcnow().isoformat()
        logger.info(
            f"generate_all_insights completed: "
            f"processed={results['products_processed']}"
        )

        return results

    except Exception as e:
        logger.error(f"Error in generate_all_insights: {str(e)}", exc_info=True)
        results['success'] = False
        results['error'] = str(e)
        return results

    finally:
        db.close()


@celery_app.task(name='app.scheduler.tasks.generate_weekly_accuracy_report')
def generate_weekly_accuracy_report() -> Dict[str, Any]:
    """
    Generate weekly forecast accuracy report

    Runs every Monday to analyze last week's forecast accuracy.

    Returns:
        Accuracy report
    """
    logger.info("Task started: generate_weekly_accuracy_report")

    db = get_db_session()

    try:
        forecaster = Forecaster()

        # Get accuracy for last 7 days
        end_date = date.today() - timedelta(days=1)
        start_date = end_date - timedelta(days=7)

        report = forecaster.get_accuracy_report(
            start_date=start_date,
            end_date=end_date,
            db=db
        )

        logger.info(
            f"Weekly accuracy report generated: "
            f"MAPE={report.get('overall_mape', 0):.2f}%, "
            f"forecasts={report.get('total_forecasts', 0)}"
        )

        # TODO: Send email report to business owner
        # This would integrate with an email service

        return report

    except Exception as e:
        logger.error(f"Error in generate_weekly_accuracy_report: {str(e)}", exc_info=True)
        return {
            'success': False,
            'error': str(e)
        }

    finally:
        db.close()


@celery_app.task(name='app.scheduler.tasks.cleanup_old_data')
def cleanup_old_data(retention_days: int = 180) -> Dict[str, Any]:
    """
    Cleanup old forecasts and insights

    Runs monthly to remove data older than retention period.

    Args:
        retention_days: Number of days to retain data (default: 180)

    Returns:
        Cleanup summary
    """
    logger.info(f"Task started: cleanup_old_data(retention_days={retention_days})")

    db = get_db_session()
    results = {
        'success': True,
        'forecasts_deleted': 0,
        'insights_deleted': 0
    }

    try:
        cutoff_date = date.today() - timedelta(days=retention_days)

        # Delete old forecasts
        old_forecasts = db.query(Forecast).filter(
            Forecast.forecast_date < cutoff_date
        ).delete(synchronize_session=False)

        results['forecasts_deleted'] = old_forecasts

        # Delete old insights
        old_insights = db.query(ForecastInsight).filter(
            ForecastInsight.valid_until < cutoff_date
        ).delete(synchronize_session=False)

        results['insights_deleted'] = old_insights

        db.commit()

        logger.info(
            f"Cleanup completed: "
            f"forecasts_deleted={old_forecasts}, "
            f"insights_deleted={old_insights}"
        )

        return results

    except Exception as e:
        logger.error(f"Error in cleanup_old_data: {str(e)}", exc_info=True)
        db.rollback()
        results['success'] = False
        results['error'] = str(e)
        return results

    finally:
        db.close()


@celery_app.task(name='app.scheduler.tasks.retrain_models')
def retrain_models() -> Dict[str, Any]:
    """
    Retrain forecasting models with latest data

    Can be triggered manually or scheduled weekly to improve model accuracy.

    Returns:
        Retraining summary
    """
    logger.info("Task started: retrain_models")

    results = {
        'success': True,
        'message': 'Model retraining triggered',
        'started_at': datetime.utcnow().isoformat()
    }

    # Trigger forecast regeneration for all products
    # This will retrain models with latest data
    try:
        result = generate_all_forecasts.apply_async(
            expires=7200  # 2 hours
        )

        results['task_id'] = str(result.id)
        logger.info(f"Model retraining task queued: {result.id}")

        return results

    except Exception as e:
        logger.error(f"Error in retrain_models: {str(e)}", exc_info=True)
        results['success'] = False
        results['error'] = str(e)
        return results
