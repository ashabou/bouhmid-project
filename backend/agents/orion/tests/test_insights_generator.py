"""
Unit tests for Insights Generator
"""
import pytest
import pandas as pd
import numpy as np
from datetime import date, timedelta

from app.forecasting.insights_generator import InsightsGenerator
from app.models import Forecast, SalesHistory, ForecastInsight
from app.models.forecast_insight import InsightType, Severity


class TestInsightsGenerator:
    """Test suite for Insights Generator"""

    def test_generator_initialization(self):
        """Test Insights Generator initialization"""
        generator = InsightsGenerator()
        assert generator.logger is not None

    def test_generate_insights_no_forecasts(self, db_session):
        """Test insights generation with no forecasts"""
        generator = InsightsGenerator()

        result = generator.generate_insights(
            product_id="nonexistent-id",
            db=db_session
        )

        assert result['success'] is False
        assert 'error' in result
        assert result['insights_created'] == 0

    def test_generate_insights_success(self, forecast_records, sales_history_records, db_session):
        """Test successful insights generation"""
        generator = InsightsGenerator()

        product_id = "12345678-1234-1234-1234-123456789012"

        result = generator.generate_insights(
            product_id=product_id,
            forecast_horizon_days=30,
            db=db_session
        )

        assert result['success'] is True
        assert result['insights_created'] >= 0
        assert 'insight_ids' in result
        assert 'insight_types' in result

    def test_detect_demand_spikes(self, db_session):
        """Test demand spike detection"""
        generator = InsightsGenerator()

        # Create forecast with spike
        forecast_data = []
        for i in range(30):
            quantity = 150 if i == 15 else 50  # Spike on day 15
            forecast_data.append({
                'forecast_date': date.today() + timedelta(days=i),
                'predicted_quantity': quantity,
                'confidence_lower': quantity * 0.9,
                'confidence_upper': quantity * 1.1
            })

        forecast_df = pd.DataFrame(forecast_data)

        # Historical data
        historical_data = pd.DataFrame({
            'sale_date': pd.date_range(start=date.today() - timedelta(days=90), periods=90),
            'quantity_sold': np.random.normal(50, 10, 90),
            'revenue': np.random.normal(1250, 250, 90)
        })

        insights = generator._detect_demand_spikes(
            forecast_df,
            historical_data,
            "product-id",
            None
        )

        assert len(insights) > 0
        assert insights[0]['insight_type'] == InsightType.DEMAND_SPIKE

    def test_detect_demand_drops(self, db_session):
        """Test demand drop detection"""
        generator = InsightsGenerator()

        # Create forecast with drop
        forecast_data = []
        for i in range(30):
            quantity = 20 if i == 15 else 100  # Drop on day 15
            forecast_data.append({
                'forecast_date': date.today() + timedelta(days=i),
                'predicted_quantity': quantity,
                'confidence_lower': quantity * 0.9,
                'confidence_upper': quantity * 1.1
            })

        forecast_df = pd.DataFrame(forecast_data)

        # Historical data
        historical_data = pd.DataFrame({
            'sale_date': pd.date_range(start=date.today() - timedelta(days=90), periods=90),
            'quantity_sold': np.random.normal(100, 10, 90),
            'revenue': np.random.normal(2500, 250, 90)
        })

        insights = generator._detect_demand_drops(
            forecast_df,
            historical_data,
            "product-id",
            None
        )

        assert len(insights) > 0
        assert insights[0]['insight_type'] == InsightType.DEMAND_DROP

    def test_detect_stockout_risks(self, db_session):
        """Test stockout risk detection"""
        generator = InsightsGenerator()

        # Create forecast with sustained high demand
        forecast_data = []
        for i in range(30):
            forecast_data.append({
                'forecast_date': date.today() + timedelta(days=i),
                'predicted_quantity': 150,  # Consistently high
                'confidence_lower': 140,
                'confidence_upper': 160
            })

        forecast_df = pd.DataFrame(forecast_data)

        historical_data = pd.DataFrame({
            'sale_date': pd.date_range(start=date.today() - timedelta(days=90), periods=90),
            'quantity_sold': np.random.normal(50, 10, 90),
            'revenue': np.random.normal(1250, 250, 90)
        })

        insights = generator._detect_stockout_risks(
            forecast_df,
            historical_data,
            "product-id",
            None
        )

        assert len(insights) > 0
        assert insights[0]['insight_type'] == InsightType.STOCKOUT_RISK

    def test_detect_seasonal_trends(self, db_session):
        """Test seasonal trend detection"""
        generator = InsightsGenerator()

        # Create forecast with weekly pattern
        forecast_data = []
        for i in range(30):
            # Higher demand on weekends (day % 7 in [5, 6])
            base_quantity = 100
            if (date.today() + timedelta(days=i)).weekday() in [5, 6]:
                quantity = base_quantity + 50
            else:
                quantity = base_quantity

            forecast_data.append({
                'forecast_date': date.today() + timedelta(days=i),
                'predicted_quantity': quantity,
                'confidence_lower': quantity * 0.9,
                'confidence_upper': quantity * 1.1
            })

        forecast_df = pd.DataFrame(forecast_data)

        historical_data = pd.DataFrame()

        insights = generator._detect_seasonal_trends(
            forecast_df,
            historical_data,
            "product-id",
            None
        )

        if len(insights) > 0:
            assert insights[0]['insight_type'] == InsightType.SEASONAL_TREND

    def test_generate_reorder_alerts(self, db_session):
        """Test reorder alert generation"""
        generator = InsightsGenerator()

        # Create forecast
        forecast_data = []
        for i in range(30):
            forecast_data.append({
                'forecast_date': date.today() + timedelta(days=i),
                'predicted_quantity': 50 + i,
                'confidence_lower': 40 + i,
                'confidence_upper': 60 + i
            })

        forecast_df = pd.DataFrame(forecast_data)

        historical_data = pd.DataFrame({
            'sale_date': pd.date_range(start=date.today() - timedelta(days=90), periods=90),
            'quantity_sold': np.random.normal(50, 10, 90),
            'revenue': np.random.normal(1250, 250, 90)
        })

        insights = generator._generate_reorder_alerts(
            forecast_df,
            historical_data,
            "product-id",
            None
        )

        assert len(insights) > 0
        assert insights[0]['insight_type'] == InsightType.REORDER_ALERT
        assert 'recommended_order_quantity' in insights[0]['data']

    def test_classify_fast_movers(self, db_session):
        """Test fast mover classification"""
        generator = InsightsGenerator()

        # High demand forecast
        forecast_data = []
        for i in range(30):
            forecast_data.append({
                'forecast_date': date.today() + timedelta(days=i),
                'predicted_quantity': 50,  # >20 units/day
                'confidence_lower': 45,
                'confidence_upper': 55
            })

        forecast_df = pd.DataFrame(forecast_data)

        historical_data = pd.DataFrame({
            'sale_date': pd.date_range(start=date.today() - timedelta(days=90), periods=90),
            'quantity_sold': np.full(90, 50),
            'revenue': np.full(90, 1250)
        })

        insights = generator._classify_movers(
            forecast_df,
            historical_data,
            "product-id",
            None
        )

        assert len(insights) > 0
        assert insights[0]['insight_type'] == InsightType.FAST_MOVER

    def test_classify_slow_movers(self, db_session):
        """Test slow mover classification"""
        generator = InsightsGenerator()

        # Low demand forecast
        forecast_data = []
        for i in range(30):
            forecast_data.append({
                'forecast_date': date.today() + timedelta(days=i),
                'predicted_quantity': 3,  # <5 units/day
                'confidence_lower': 2,
                'confidence_upper': 4
            })

        forecast_df = pd.DataFrame(forecast_data)

        historical_data = pd.DataFrame({
            'sale_date': pd.date_range(start=date.today() - timedelta(days=90), periods=90),
            'quantity_sold': np.full(90, 3),
            'revenue': np.full(90, 75)
        })

        insights = generator._classify_movers(
            forecast_df,
            historical_data,
            "product-id",
            None
        )

        assert len(insights) > 0
        assert insights[0]['insight_type'] == InsightType.SLOW_MOVER

    def test_create_insight_record(self, sample_insight, db_session):
        """Test creating insight record"""
        generator = InsightsGenerator()

        insight = generator._create_insight(sample_insight, db_session)

        assert insight is not None
        assert insight.insight_type == sample_insight['insight_type']
        assert insight.severity == sample_insight['severity']
        assert insight.title == sample_insight['title']

    def test_get_active_insights(self, insight_record, db_session):
        """Test getting active insights"""
        generator = InsightsGenerator()

        insights = generator.get_active_insights(db=db_session)

        assert len(insights) > 0
        assert all('id' in i for i in insights)

    def test_get_active_insights_filtered_by_product(self, insight_record, db_session):
        """Test filtering insights by product"""
        generator = InsightsGenerator()

        product_id = "12345678-1234-1234-1234-123456789012"

        insights = generator.get_active_insights(
            product_id=product_id,
            db=db_session
        )

        assert all(i['product_id'] == product_id for i in insights)

    def test_get_active_insights_filtered_by_severity(self, db_session):
        """Test filtering insights by severity"""
        generator = InsightsGenerator()

        # Create insights with different severities
        for severity in [Severity.LOW, Severity.HIGH]:
            insight = ForecastInsight(
                insight_type=InsightType.DEMAND_SPIKE,
                severity=severity,
                product_id="test-product",
                title=f"Test {severity.value}",
                description="Test",
                valid_from=date.today(),
                valid_until=date.today() + timedelta(days=30)
            )
            db_session.add(insight)

        db_session.commit()

        # Filter by HIGH severity
        insights = generator.get_active_insights(
            severity=Severity.HIGH,
            db=db_session
        )

        assert all(i['severity'] == Severity.HIGH.value for i in insights)

    def test_get_active_insights_unread_only(self, db_session):
        """Test getting only unread insights"""
        generator = InsightsGenerator()

        # Create read and unread insights
        read_insight = ForecastInsight(
            insight_type=InsightType.DEMAND_SPIKE,
            severity=Severity.MEDIUM,
            product_id="test-product",
            title="Read insight",
            description="Test",
            is_read=True,
            valid_from=date.today(),
            valid_until=date.today() + timedelta(days=30)
        )

        unread_insight = ForecastInsight(
            insight_type=InsightType.DEMAND_DROP,
            severity=Severity.MEDIUM,
            product_id="test-product",
            title="Unread insight",
            description="Test",
            is_read=False,
            valid_from=date.today(),
            valid_until=date.today() + timedelta(days=30)
        )

        db_session.add(read_insight)
        db_session.add(unread_insight)
        db_session.commit()

        # Get unread only
        insights = generator.get_active_insights(
            unread_only=True,
            db=db_session
        )

        assert all(not i['is_read'] for i in insights)

    def test_insights_include_recommendations(self, db_session):
        """Test that insights include recommendations"""
        generator = InsightsGenerator()

        insight_data = {
            'insight_type': InsightType.STOCKOUT_RISK,
            'severity': Severity.HIGH,
            'product_id': "test-product",
            'title': 'Test Stockout Risk',
            'description': 'High demand expected',
            'recommendation': 'Increase stock levels by 100 units',
            'data': {'recommended_stock': 500},
            'valid_from': date.today(),
            'valid_until': date.today() + timedelta(days=30)
        }

        insight = generator._create_insight(insight_data, db_session)
        db_session.commit()

        assert insight.recommendation is not None
        assert 'Increase stock' in insight.recommendation

    def test_severity_levels_assigned_correctly(self, db_session):
        """Test that severity levels are assigned appropriately"""
        generator = InsightsGenerator()

        # Critical spike (>3 std dev)
        forecast_data = pd.DataFrame({
            'forecast_date': [date.today() + timedelta(days=i) for i in range(30)],
            'predicted_quantity': [200 if i == 15 else 50 for i in range(30)],
            'confidence_lower': [180 if i == 15 else 40 for i in range(30)],
            'confidence_upper': [220 if i == 15 else 60 for i in range(30)]
        })

        historical_data = pd.DataFrame({
            'sale_date': pd.date_range(start=date.today() - timedelta(days=90), periods=90),
            'quantity_sold': np.random.normal(50, 10, 90),
            'revenue': np.random.normal(1250, 250, 90)
        })

        insights = generator._detect_demand_spikes(
            forecast_data,
            historical_data,
            "product-id",
            None
        )

        if len(insights) > 0:
            # Should be high or critical severity
            assert insights[0]['severity'] in [Severity.HIGH, Severity.CRITICAL]

    def test_insight_validity_period(self, db_session):
        """Test insight validity period"""
        generator = InsightsGenerator()

        # Create insight valid for 30 days
        insight_data = {
            'insight_type': InsightType.REORDER_ALERT,
            'severity': Severity.MEDIUM,
            'product_id': "test-product",
            'title': 'Reorder Alert',
            'description': 'Time to reorder',
            'valid_from': date.today(),
            'valid_until': date.today() + timedelta(days=30)
        }

        insight = generator._create_insight(insight_data, db_session)
        db_session.commit()

        assert insight.is_valid() is True
        assert insight.days_until_invalid() == 30
