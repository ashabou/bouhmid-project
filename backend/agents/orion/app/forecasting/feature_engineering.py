"""
Feature Engineering for Demand Forecasting

Creates time-series features for ML models including:
- Temporal features (seasonality, trends)
- Lag features
- Rolling statistics
- External features (weather, holidays)
"""
import logging
import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models.sales_history import SalesHistory
from ..config import settings

logger = logging.getLogger(__name__)


class FeatureEngineer:
    """
    Feature engineering for time series forecasting

    Transforms raw sales data into feature-rich datasets for ML models
    """

    # Tunisian public holidays (approximate - need to be adjusted yearly)
    TUNISIA_HOLIDAYS = [
        # Fixed holidays
        (1, 1),    # New Year
        (3, 20),   # Independence Day
        (4, 9),    # Martyrs' Day
        (5, 1),    # Labour Day
        (7, 25),   # Republic Day
        (8, 13),   # Women's Day
        (10, 15),  # Evacuation Day
        # Islamic holidays (dates vary yearly - these are approximate)
        # Eid al-Fitr, Eid al-Adha, Islamic New Year, Prophet's Birthday
    ]

    def __init__(self):
        """Initialize feature engineer"""
        self.logger = logger

    def prepare_time_series(
        self,
        product_id: Optional[str] = None,
        sku: Optional[str] = None,
        category_id: Optional[int] = None,
        db: Session = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> pd.DataFrame:
        """
        Prepare time series data with features

        Args:
            product_id: Filter by product ID
            sku: Filter by SKU
            category_id: Filter by category ID
            db: Database session
            start_date: Start date for data
            end_date: End date for data

        Returns:
            DataFrame with engineered features
        """
        self.logger.info(
            f"Preparing time series for product_id={product_id}, sku={sku}, category_id={category_id}"
        )

        # Load sales data
        df = self._load_sales_data(
            product_id=product_id,
            sku=sku,
            category_id=category_id,
            db=db,
            start_date=start_date,
            end_date=end_date
        )

        if df.empty:
            self.logger.warning("No sales data found")
            return df

        # Aggregate by date
        df = self._aggregate_daily(df)

        # Add temporal features
        df = self._add_temporal_features(df)

        # Add lag features
        df = self._add_lag_features(df)

        # Add rolling features
        df = self._add_rolling_features(df)

        # Add holiday features
        df = self._add_holiday_features(df)

        # Add trend features
        df = self._add_trend_features(df)

        # Fill missing values
        df = self._handle_missing_values(df)

        self.logger.info(f"Prepared time series with {len(df)} rows and {len(df.columns)} features")
        return df

    def _load_sales_data(
        self,
        product_id: Optional[str],
        sku: Optional[str],
        category_id: Optional[int],
        db: Session,
        start_date: Optional[date],
        end_date: Optional[date]
    ) -> pd.DataFrame:
        """
        Load sales data from database

        Args:
            product_id: Filter by product ID
            sku: Filter by SKU
            category_id: Filter by category ID
            db: Database session
            start_date: Start date
            end_date: End date

        Returns:
            Raw sales data as DataFrame
        """
        # Build query
        query = db.query(
            SalesHistory.sale_date,
            SalesHistory.quantity_sold,
            SalesHistory.unit_price,
            SalesHistory.total_revenue
        )

        # Apply filters
        if product_id:
            query = query.filter(SalesHistory.product_id == product_id)
        elif sku:
            query = query.filter(SalesHistory.sku == sku)
        elif category_id:
            query = query.filter(SalesHistory.category_id == category_id)

        if start_date:
            query = query.filter(SalesHistory.sale_date >= start_date)
        if end_date:
            query = query.filter(SalesHistory.sale_date <= end_date)

        # Order by date
        query = query.order_by(SalesHistory.sale_date)

        # Execute and convert to DataFrame
        results = query.all()
        df = pd.DataFrame(results, columns=['sale_date', 'quantity_sold', 'unit_price', 'total_revenue'])

        return df

    def _aggregate_daily(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Aggregate sales by day

        Args:
            df: Raw sales data

        Returns:
            Daily aggregated data
        """
        # Group by date and sum quantities/revenue
        daily = df.groupby('sale_date').agg({
            'quantity_sold': 'sum',
            'total_revenue': 'sum',
            'unit_price': 'mean'  # Average price
        }).reset_index()

        # Ensure continuous date range (fill gaps with zeros)
        date_range = pd.date_range(
            start=daily['sale_date'].min(),
            end=daily['sale_date'].max(),
            freq='D'
        )

        # Create full date range DataFrame
        full_df = pd.DataFrame({'sale_date': date_range})
        full_df = full_df.merge(daily, on='sale_date', how='left')

        # Fill missing values with 0 for quantity/revenue
        full_df['quantity_sold'] = full_df['quantity_sold'].fillna(0)
        full_df['total_revenue'] = full_df['total_revenue'].fillna(0)

        # Forward fill unit_price (use last known price)
        full_df['unit_price'] = full_df['unit_price'].fillna(method='ffill')

        return full_df

    def _add_temporal_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Add temporal features (seasonality, day of week, etc.)

        Args:
            df: DataFrame with sale_date

        Returns:
            DataFrame with temporal features
        """
        df = df.copy()

        # Ensure sale_date is datetime
        df['sale_date'] = pd.to_datetime(df['sale_date'])

        # Basic temporal features
        df['year'] = df['sale_date'].dt.year
        df['month'] = df['sale_date'].dt.month
        df['day'] = df['sale_date'].dt.day
        df['day_of_week'] = df['sale_date'].dt.dayofweek  # 0=Monday, 6=Sunday
        df['day_of_year'] = df['sale_date'].dt.dayofyear
        df['week_of_year'] = df['sale_date'].dt.isocalendar().week
        df['quarter'] = df['sale_date'].dt.quarter

        # Weekend indicator
        df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)

        # Month start/end indicators
        df['is_month_start'] = df['sale_date'].dt.is_month_start.astype(int)
        df['is_month_end'] = df['sale_date'].dt.is_month_end.astype(int)

        # Cyclical encoding for month and day_of_week
        # This helps models understand that December is close to January
        df['month_sin'] = np.sin(2 * np.pi * df['month'] / 12)
        df['month_cos'] = np.cos(2 * np.pi * df['month'] / 12)
        df['day_of_week_sin'] = np.sin(2 * np.pi * df['day_of_week'] / 7)
        df['day_of_week_cos'] = np.cos(2 * np.pi * df['day_of_week'] / 7)

        return df

    def _add_lag_features(self, df: pd.DataFrame, lags: List[int] = [1, 7, 14, 30]) -> pd.DataFrame:
        """
        Add lag features (previous values)

        Args:
            df: DataFrame with quantity_sold
            lags: List of lag periods

        Returns:
            DataFrame with lag features
        """
        df = df.copy()

        for lag in lags:
            df[f'quantity_lag_{lag}'] = df['quantity_sold'].shift(lag)
            df[f'revenue_lag_{lag}'] = df['total_revenue'].shift(lag)

        return df

    def _add_rolling_features(
        self,
        df: pd.DataFrame,
        windows: List[int] = [7, 14, 30]
    ) -> pd.DataFrame:
        """
        Add rolling window features (moving averages, std, etc.)

        Args:
            df: DataFrame with quantity_sold
            windows: List of window sizes

        Returns:
            DataFrame with rolling features
        """
        df = df.copy()

        for window in windows:
            # Rolling mean
            df[f'quantity_rolling_mean_{window}'] = (
                df['quantity_sold'].rolling(window=window, min_periods=1).mean()
            )

            # Rolling std
            df[f'quantity_rolling_std_{window}'] = (
                df['quantity_sold'].rolling(window=window, min_periods=1).std()
            )

            # Rolling min/max
            df[f'quantity_rolling_min_{window}'] = (
                df['quantity_sold'].rolling(window=window, min_periods=1).min()
            )
            df[f'quantity_rolling_max_{window}'] = (
                df['quantity_sold'].rolling(window=window, min_periods=1).max()
            )

        return df

    def _add_holiday_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Add holiday indicator features

        Args:
            df: DataFrame with sale_date

        Returns:
            DataFrame with holiday features
        """
        df = df.copy()

        # Check if date is a holiday
        df['is_holiday'] = df['sale_date'].apply(
            lambda x: int((x.month, x.day) in self.TUNISIA_HOLIDAYS)
        )

        # Days since/until holiday
        df['days_to_holiday'] = 0
        df['days_since_holiday'] = 0

        for idx, row in df.iterrows():
            current_date = row['sale_date']

            # Find nearest holidays
            distances_to_holidays = []
            for month, day in self.TUNISIA_HOLIDAYS:
                # Try this year
                try:
                    holiday = datetime(current_date.year, month, day).date()
                    distances_to_holidays.append((holiday - current_date.date()).days)
                except ValueError:
                    pass

                # Try next year
                try:
                    holiday = datetime(current_date.year + 1, month, day).date()
                    distances_to_holidays.append((holiday - current_date.date()).days)
                except ValueError:
                    pass

                # Try previous year
                try:
                    holiday = datetime(current_date.year - 1, month, day).date()
                    distances_to_holidays.append((holiday - current_date.date()).days)
                except ValueError:
                    pass

            if distances_to_holidays:
                future_distances = [d for d in distances_to_holidays if d > 0]
                past_distances = [abs(d) for d in distances_to_holidays if d < 0]

                df.at[idx, 'days_to_holiday'] = min(future_distances) if future_distances else 365
                df.at[idx, 'days_since_holiday'] = min(past_distances) if past_distances else 365

        return df

    def _add_trend_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Add trend features

        Args:
            df: DataFrame with sale_date

        Returns:
            DataFrame with trend features
        """
        df = df.copy()

        # Add time index (days since start)
        df['days_since_start'] = (df['sale_date'] - df['sale_date'].min()).dt.days

        # Add linear trend component
        if len(df) > 1:
            # Simple linear regression for trend
            from scipy import stats
            x = df['days_since_start'].values
            y = df['quantity_sold'].values
            slope, intercept, _, _, _ = stats.linregress(x, y)
            df['linear_trend'] = slope * x + intercept
        else:
            df['linear_trend'] = df['quantity_sold']

        return df

    def _handle_missing_values(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Handle missing values in features

        Args:
            df: DataFrame with features

        Returns:
            DataFrame with no missing values
        """
        df = df.copy()

        # Forward fill lag features
        lag_cols = [col for col in df.columns if 'lag_' in col]
        for col in lag_cols:
            df[col] = df[col].fillna(method='ffill').fillna(0)

        # Fill rolling features
        rolling_cols = [col for col in df.columns if 'rolling_' in col]
        for col in rolling_cols:
            df[col] = df[col].fillna(method='bfill').fillna(0)

        # Fill any remaining NaN
        df = df.fillna(0)

        return df

    def get_feature_importance(
        self,
        df: pd.DataFrame,
        target_col: str = 'quantity_sold'
    ) -> pd.DataFrame:
        """
        Calculate feature importance using correlation

        Args:
            df: DataFrame with features
            target_col: Target column name

        Returns:
            DataFrame with feature importance scores
        """
        # Exclude non-numeric and date columns
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        numeric_cols = [col for col in numeric_cols if col != target_col]

        # Calculate correlation with target
        correlations = []
        for col in numeric_cols:
            corr = df[col].corr(df[target_col])
            correlations.append({
                'feature': col,
                'correlation': abs(corr),
                'correlation_sign': 'positive' if corr > 0 else 'negative'
            })

        # Sort by absolute correlation
        importance_df = pd.DataFrame(correlations)
        importance_df = importance_df.sort_values('correlation', ascending=False)

        return importance_df

    def split_train_test(
        self,
        df: pd.DataFrame,
        test_size: float = 0.2
    ) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """
        Split data into train and test sets (time-based split)

        Args:
            df: DataFrame with features
            test_size: Proportion of data for test set

        Returns:
            Tuple of (train_df, test_df)
        """
        # Time-based split (last N% for test)
        split_idx = int(len(df) * (1 - test_size))

        train_df = df.iloc[:split_idx].copy()
        test_df = df.iloc[split_idx:].copy()

        self.logger.info(
            f"Split data: {len(train_df)} train samples, {len(test_df)} test samples"
        )

        return train_df, test_df
