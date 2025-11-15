"""
Insights Generator

Analyzes forecasts and generates actionable business insights
Identifies trends, risks, and opportunities from demand predictions
"""
import logging
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from ..models import Forecast, ForecastInsight, SalesHistory
from ..models.forecast_insight import InsightType, Severity
from ..config import settings

logger = logging.getLogger(__name__)


class InsightsGenerator:
    """
    Generates actionable insights from forecasts

    Analyzes forecast data to identify:
    - Demand spikes and drops
    - Stockout risks
    - Overstock risks
    - Seasonal trends
    - Reorder alerts
    """

    def __init__(self):
        """Initialize insights generator"""
        self.logger = logger

    def generate_insights(
        self,
        product_id: Optional[str] = None,
        category_id: Optional[int] = None,
        forecast_horizon_days: int = 30,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Generate insights for product or category

        Args:
            product_id: Product ID to analyze
            category_id: Category ID to analyze
            forecast_horizon_days: Number of days to analyze
            db: Database session

        Returns:
            Insights generation results
        """
        self.logger.info(
            f"Generating insights for product_id={product_id}, "
            f"category_id={category_id}"
        )

        try:
            insights_created = []

            # Get forecasts for the period
            forecasts = self._get_forecasts(
                product_id=product_id,
                category_id=category_id,
                days=forecast_horizon_days,
                db=db
            )

            if not forecasts:
                return {
                    'success': False,
                    'error': 'No forecasts found',
                    'insights_created': 0
                }

            # Convert to DataFrame for analysis
            forecast_df = self._forecasts_to_dataframe(forecasts)

            # Get historical data for comparison
            historical_df = self._get_historical_data(
                product_id=product_id,
                category_id=category_id,
                days=90,  # Last 90 days
                db=db
            )

            # Generate different types of insights
            insights = []

            # 1. Demand spike detection
            spike_insights = self._detect_demand_spikes(
                forecast_df, historical_df, product_id, category_id
            )
            insights.extend(spike_insights)

            # 2. Demand drop detection
            drop_insights = self._detect_demand_drops(
                forecast_df, historical_df, product_id, category_id
            )
            insights.extend(drop_insights)

            # 3. Stockout risk detection
            stockout_insights = self._detect_stockout_risks(
                forecast_df, historical_df, product_id, category_id
            )
            insights.extend(stockout_insights)

            # 4. Seasonal trend detection
            seasonal_insights = self._detect_seasonal_trends(
                forecast_df, historical_df, product_id, category_id
            )
            insights.extend(seasonal_insights)

            # 5. Reorder alerts
            reorder_insights = self._generate_reorder_alerts(
                forecast_df, historical_df, product_id, category_id
            )
            insights.extend(reorder_insights)

            # 6. Fast/slow mover classification
            mover_insights = self._classify_movers(
                forecast_df, historical_df, product_id, category_id
            )
            insights.extend(mover_insights)

            # Store insights in database
            for insight_data in insights:
                insight = self._create_insight(insight_data, db)
                if insight:
                    insights_created.append(insight.id)

            db.commit()

            return {
                'success': True,
                'insights_created': len(insights_created),
                'insight_ids': [str(id) for id in insights_created],
                'insight_types': [i['insight_type'] for i in insights],
                'generated_at': datetime.utcnow().isoformat()
            }

        except Exception as e:
            self.logger.error(f"Error generating insights: {str(e)}", exc_info=True)
            db.rollback() if db else None
            return {
                'success': False,
                'error': str(e),
                'insights_created': 0
            }

    def _get_forecasts(
        self,
        product_id: Optional[str],
        category_id: Optional[int],
        days: int,
        db: Session
    ) -> List[Forecast]:
        """Get forecasts for analysis"""
        end_date = date.today() + timedelta(days=days)
        query = db.query(Forecast).filter(
            Forecast.forecast_date >= date.today(),
            Forecast.forecast_date <= end_date
        )

        if product_id:
            query = query.filter(Forecast.product_id == product_id)

        return query.order_by(Forecast.forecast_date).all()

    def _get_historical_data(
        self,
        product_id: Optional[str],
        category_id: Optional[int],
        days: int,
        db: Session
    ) -> pd.DataFrame:
        """Get historical sales data"""
        start_date = date.today() - timedelta(days=days)
        query = db.query(SalesHistory).filter(
            SalesHistory.sale_date >= start_date,
            SalesHistory.sale_date < date.today()
        )

        if product_id:
            query = query.filter(SalesHistory.product_id == product_id)

        results = query.order_by(SalesHistory.sale_date).all()

        if not results:
            return pd.DataFrame()

        data = [{
            'sale_date': r.sale_date,
            'quantity_sold': r.quantity_sold,
            'revenue': r.revenue
        } for r in results]

        return pd.DataFrame(data)

    def _forecasts_to_dataframe(self, forecasts: List[Forecast]) -> pd.DataFrame:
        """Convert forecasts to DataFrame"""
        data = [{
            'forecast_date': f.forecast_date,
            'predicted_quantity': f.predicted_quantity,
            'confidence_lower': f.confidence_interval_lower,
            'confidence_upper': f.confidence_interval_upper
        } for f in forecasts]

        return pd.DataFrame(data)

    def _detect_demand_spikes(
        self,
        forecast_df: pd.DataFrame,
        historical_df: pd.DataFrame,
        product_id: Optional[str],
        category_id: Optional[int]
    ) -> List[Dict[str, Any]]:
        """Detect predicted demand spikes"""
        insights = []

        if forecast_df.empty or historical_df.empty:
            return insights

        # Calculate historical average
        historical_avg = historical_df['quantity_sold'].mean()
        historical_std = historical_df['quantity_sold'].std()

        # Detect spikes (>2 standard deviations above mean)
        threshold = historical_avg + (2 * historical_std)

        spikes = forecast_df[forecast_df['predicted_quantity'] > threshold]

        if not spikes.empty:
            max_spike = spikes['predicted_quantity'].max()
            spike_date = spikes.loc[spikes['predicted_quantity'].idxmax(), 'forecast_date']

            # Determine severity
            if max_spike > historical_avg + (3 * historical_std):
                severity = Severity.CRITICAL
            elif max_spike > historical_avg + (2.5 * historical_std):
                severity = Severity.HIGH
            else:
                severity = Severity.MEDIUM

            insights.append({
                'insight_type': InsightType.DEMAND_SPIKE,
                'severity': severity,
                'product_id': product_id,
                'category_id': category_id,
                'title': 'Demand Spike Expected',
                'description': (
                    f"Predicted demand spike of {int(max_spike)} units on {spike_date}, "
                    f"which is {int((max_spike - historical_avg) / historical_avg * 100)}% "
                    f"above historical average of {int(historical_avg)} units."
                ),
                'recommendation': (
                    f"Increase inventory levels by {int(max_spike - historical_avg)} units "
                    f"before {spike_date} to avoid stockouts."
                ),
                'data': {
                    'predicted_quantity': float(max_spike),
                    'historical_average': float(historical_avg),
                    'spike_date': spike_date.isoformat() if hasattr(spike_date, 'isoformat') else str(spike_date),
                    'increase_percentage': float((max_spike - historical_avg) / historical_avg * 100)
                },
                'valid_from': date.today(),
                'valid_until': spike_date if isinstance(spike_date, date) else date.today() + timedelta(days=30)
            })

        return insights

    def _detect_demand_drops(
        self,
        forecast_df: pd.DataFrame,
        historical_df: pd.DataFrame,
        product_id: Optional[str],
        category_id: Optional[int]
    ) -> List[Dict[str, Any]]:
        """Detect predicted demand drops"""
        insights = []

        if forecast_df.empty or historical_df.empty:
            return insights

        # Calculate historical average
        historical_avg = historical_df['quantity_sold'].mean()
        historical_std = historical_df['quantity_sold'].std()

        # Detect drops (>50% below mean)
        threshold = historical_avg * 0.5

        drops = forecast_df[forecast_df['predicted_quantity'] < threshold]

        if not drops.empty:
            min_demand = drops['predicted_quantity'].min()
            drop_date = drops.loc[drops['predicted_quantity'].idxmin(), 'forecast_date']

            severity = Severity.MEDIUM if min_demand < historical_avg * 0.3 else Severity.LOW

            insights.append({
                'insight_type': InsightType.DEMAND_DROP,
                'severity': severity,
                'product_id': product_id,
                'category_id': category_id,
                'title': 'Demand Drop Expected',
                'description': (
                    f"Predicted demand drop to {int(min_demand)} units on {drop_date}, "
                    f"which is {int((historical_avg - min_demand) / historical_avg * 100)}% "
                    f"below historical average of {int(historical_avg)} units."
                ),
                'recommendation': (
                    "Consider reducing inventory levels or planning promotions to maintain sales."
                ),
                'data': {
                    'predicted_quantity': float(min_demand),
                    'historical_average': float(historical_avg),
                    'drop_date': drop_date.isoformat() if hasattr(drop_date, 'isoformat') else str(drop_date),
                    'decrease_percentage': float((historical_avg - min_demand) / historical_avg * 100)
                },
                'valid_from': date.today(),
                'valid_until': drop_date if isinstance(drop_date, date) else date.today() + timedelta(days=30)
            })

        return insights

    def _detect_stockout_risks(
        self,
        forecast_df: pd.DataFrame,
        historical_df: pd.DataFrame,
        product_id: Optional[str],
        category_id: Optional[int]
    ) -> List[Dict[str, Any]]:
        """Detect stockout risks based on high demand"""
        insights = []

        if forecast_df.empty:
            return insights

        # Calculate average predicted demand
        avg_demand = forecast_df['predicted_quantity'].mean()

        # High demand threshold (>80th percentile)
        high_demand_threshold = forecast_df['predicted_quantity'].quantile(0.8)

        high_demand_days = forecast_df[forecast_df['predicted_quantity'] >= high_demand_threshold]

        if len(high_demand_days) >= 5:  # At least 5 days of high demand
            severity = Severity.HIGH

            insights.append({
                'insight_type': InsightType.STOCKOUT_RISK,
                'severity': severity,
                'product_id': product_id,
                'category_id': category_id,
                'title': 'Stockout Risk Detected',
                'description': (
                    f"High demand expected for {len(high_demand_days)} days in the forecast period. "
                    f"Average predicted demand: {int(avg_demand)} units/day."
                ),
                'recommendation': (
                    f"Ensure minimum stock level of {int(avg_demand * 7)} units "
                    f"(7-day supply) to prevent stockouts."
                ),
                'data': {
                    'avg_demand': float(avg_demand),
                    'high_demand_days': len(high_demand_days),
                    'recommended_stock_level': float(avg_demand * 7)
                },
                'valid_from': date.today(),
                'valid_until': date.today() + timedelta(days=30)
            })

        return insights

    def _detect_seasonal_trends(
        self,
        forecast_df: pd.DataFrame,
        historical_df: pd.DataFrame,
        product_id: Optional[str],
        category_id: Optional[int]
    ) -> List[Dict[str, Any]]:
        """Detect seasonal trends"""
        insights = []

        if forecast_df.empty or len(forecast_df) < 7:
            return insights

        # Look for weekly patterns
        forecast_df['day_of_week'] = pd.to_datetime(forecast_df['forecast_date']).dt.dayofweek
        weekly_pattern = forecast_df.groupby('day_of_week')['predicted_quantity'].mean()

        max_day = weekly_pattern.idxmax()
        min_day = weekly_pattern.idxmin()
        variation = (weekly_pattern.max() - weekly_pattern.min()) / weekly_pattern.mean()

        if variation > 0.3:  # >30% variation indicates seasonality
            day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

            insights.append({
                'insight_type': InsightType.SEASONAL_TREND,
                'severity': Severity.LOW,
                'product_id': product_id,
                'category_id': category_id,
                'title': 'Weekly Seasonal Pattern Detected',
                'description': (
                    f"Demand peaks on {day_names[max_day]} ({int(weekly_pattern[max_day])} units) "
                    f"and is lowest on {day_names[min_day]} ({int(weekly_pattern[min_day])} units). "
                    f"Weekly variation: {int(variation * 100)}%."
                ),
                'recommendation': (
                    f"Schedule restocking and promotions around {day_names[max_day]} "
                    f"to capitalize on peak demand."
                ),
                'data': {
                    'peak_day': day_names[max_day],
                    'low_day': day_names[min_day],
                    'peak_demand': float(weekly_pattern[max_day]),
                    'low_demand': float(weekly_pattern[min_day]),
                    'variation_percentage': float(variation * 100)
                },
                'valid_from': date.today(),
                'valid_until': date.today() + timedelta(days=90)
            })

        return insights

    def _generate_reorder_alerts(
        self,
        forecast_df: pd.DataFrame,
        historical_df: pd.DataFrame,
        product_id: Optional[str],
        category_id: Optional[int]
    ) -> List[Dict[str, Any]]:
        """Generate reorder alerts"""
        insights = []

        if forecast_df.empty:
            return insights

        # Calculate 7-day cumulative demand
        next_7_days = forecast_df.head(7)
        cumulative_demand = next_7_days['predicted_quantity'].sum()

        # Assume lead time of 5 days (configurable)
        lead_time_days = 5
        lead_time_demand = forecast_df.head(lead_time_days)['predicted_quantity'].sum()

        severity = Severity.MEDIUM

        insights.append({
            'insight_type': InsightType.REORDER_ALERT,
            'severity': severity,
            'product_id': product_id,
            'category_id': category_id,
            'title': 'Reorder Recommendation',
            'description': (
                f"Expected demand for next 7 days: {int(cumulative_demand)} units. "
                f"With {lead_time_days}-day lead time, need {int(lead_time_demand)} units on hand."
            ),
            'recommendation': (
                f"Reorder {int(cumulative_demand)} units now to cover next week's demand. "
                f"Maintain safety stock of {int(lead_time_demand)} units."
            ),
            'data': {
                'seven_day_demand': float(cumulative_demand),
                'lead_time_days': lead_time_days,
                'lead_time_demand': float(lead_time_demand),
                'recommended_order_quantity': float(cumulative_demand)
            },
            'valid_from': date.today(),
            'valid_until': date.today() + timedelta(days=7)
        })

        return insights

    def _classify_movers(
        self,
        forecast_df: pd.DataFrame,
        historical_df: pd.DataFrame,
        product_id: Optional[str],
        category_id: Optional[int]
    ) -> List[Dict[str, Any]]:
        """Classify products as fast or slow movers"""
        insights = []

        if forecast_df.empty or historical_df.empty:
            return insights

        # Calculate average daily demand
        avg_forecast_demand = forecast_df['predicted_quantity'].mean()
        avg_historical_demand = historical_df['quantity_sold'].mean()

        # Fast mover: >20 units/day average
        # Slow mover: <5 units/day average
        if avg_forecast_demand > 20:
            insights.append({
                'insight_type': InsightType.FAST_MOVER,
                'severity': Severity.MEDIUM,
                'product_id': product_id,
                'category_id': category_id,
                'title': 'Fast-Moving Product',
                'description': (
                    f"Product is a fast mover with average demand of {int(avg_forecast_demand)} units/day."
                ),
                'recommendation': (
                    "Maintain high stock levels and consider premium shelf placement."
                ),
                'data': {
                    'avg_daily_demand': float(avg_forecast_demand),
                    'classification': 'fast_mover'
                },
                'valid_from': date.today(),
                'valid_until': date.today() + timedelta(days=90)
            })

        elif avg_forecast_demand < 5:
            insights.append({
                'insight_type': InsightType.SLOW_MOVER,
                'severity': Severity.LOW,
                'product_id': product_id,
                'category_id': category_id,
                'title': 'Slow-Moving Product',
                'description': (
                    f"Product is a slow mover with average demand of {avg_forecast_demand:.1f} units/day."
                ),
                'recommendation': (
                    "Consider promotional activities or reduce stock levels to avoid excess inventory."
                ),
                'data': {
                    'avg_daily_demand': float(avg_forecast_demand),
                    'classification': 'slow_mover'
                },
                'valid_from': date.today(),
                'valid_until': date.today() + timedelta(days=90)
            })

        return insights

    def _create_insight(self, insight_data: Dict[str, Any], db: Session) -> Optional[ForecastInsight]:
        """Create insight in database"""
        try:
            insight = ForecastInsight(
                insight_type=insight_data['insight_type'],
                severity=insight_data['severity'],
                product_id=insight_data.get('product_id'),
                category_id=insight_data.get('category_id'),
                title=insight_data['title'],
                description=insight_data['description'],
                recommendation=insight_data.get('recommendation'),
                data=insight_data.get('data'),
                valid_from=insight_data['valid_from'],
                valid_until=insight_data['valid_until']
            )

            db.add(insight)
            return insight

        except Exception as e:
            self.logger.error(f"Error creating insight: {str(e)}", exc_info=True)
            return None

    def get_active_insights(
        self,
        product_id: Optional[str] = None,
        severity: Optional[Severity] = None,
        unread_only: bool = False,
        db: Session = None
    ) -> List[Dict[str, Any]]:
        """
        Get active insights

        Args:
            product_id: Filter by product
            severity: Filter by severity
            unread_only: Only unread insights
            db: Database session

        Returns:
            List of active insights
        """
        query = db.query(ForecastInsight).filter(
            ForecastInsight.valid_from <= date.today(),
            ForecastInsight.valid_until >= date.today()
        )

        if product_id:
            query = query.filter(ForecastInsight.product_id == product_id)

        if severity:
            query = query.filter(ForecastInsight.severity == severity)

        if unread_only:
            query = query.filter(ForecastInsight.is_read == False)

        insights = query.order_by(
            ForecastInsight.severity.desc(),
            ForecastInsight.created_at.desc()
        ).all()

        return [insight.to_dict() for insight in insights]
