"""
External Features Integration

Integrates external data sources for enhanced forecasting:
- Weather data (temperature, rainfall)
- Economic indicators
- Special events
"""
import logging
import httpx
from typing import Dict, Any, Optional
from datetime import date, datetime, timedelta
from ..config import settings

logger = logging.getLogger(__name__)


class WeatherAPIClient:
    """
    Client for weather API integration

    Uses OpenWeatherMap API to fetch historical and forecast weather data
    """

    def __init__(self):
        """Initialize weather API client"""
        self.logger = logger
        self.api_key = settings.WEATHER_API_KEY
        self.base_url = settings.WEATHER_API_URL

    async def get_historical_weather(
        self,
        city: str,
        start_date: date,
        end_date: date
    ) -> Dict[str, Any]:
        """
        Get historical weather data

        Args:
            city: City name
            start_date: Start date
            end_date: End date

        Returns:
            Weather data dictionary
        """
        if not self.api_key:
            self.logger.warning("Weather API key not configured")
            return {}

        try:
            # OpenWeatherMap API call
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.base_url}/data/2.5/weather",
                    params={
                        'q': city,
                        'appid': self.api_key,
                        'units': 'metric'
                    }
                )

                if response.status_code == 200:
                    data = response.json()
                    return {
                        'temperature': data['main']['temp'],
                        'humidity': data['main']['humidity'],
                        'pressure': data['main']['pressure'],
                        'description': data['weather'][0]['description']
                    }
                else:
                    self.logger.error(f"Weather API error: {response.status_code}")
                    return {}

        except Exception as e:
            self.logger.error(f"Error fetching weather data: {str(e)}", exc_info=True)
            return {}

    def get_seasonal_indicators(self, date_value: date) -> Dict[str, float]:
        """
        Get seasonal indicators based on date

        Args:
            date_value: Date to get indicators for

        Returns:
            Seasonal indicators
        """
        month = date_value.month

        # Tunisia has Mediterranean climate
        # Hot, dry summer (June-September)
        # Mild, wet winter (December-February)

        indicators = {
            'is_summer': 1.0 if month in [6, 7, 8, 9] else 0.0,
            'is_winter': 1.0 if month in [12, 1, 2] else 0.0,
            'is_spring': 1.0 if month in [3, 4, 5] else 0.0,
            'is_fall': 1.0 if month in [10, 11] else 0.0,
        }

        # Ramadan effect (approximate - varies yearly)
        # Assume Ramadan months (these should be updated yearly)
        ramadan_months = [4, 5]  # Example: April-May (changes yearly)
        indicators['is_ramadan_period'] = 1.0 if month in ramadan_months else 0.0

        # School holidays (Tunisia)
        # Summer: July-August
        # Winter: Late December - Early January
        indicators['is_school_holiday'] = 1.0 if month in [7, 8, 12, 1] else 0.0

        return indicators


class EconomicIndicators:
    """
    Economic indicators for forecasting

    Provides macroeconomic factors that may influence demand
    """

    def __init__(self):
        """Initialize economic indicators"""
        self.logger = logger

    def get_indicators(self, date_value: date) -> Dict[str, float]:
        """
        Get economic indicators for date

        Args:
            date_value: Date to get indicators for

        Returns:
            Economic indicators
        """
        # Placeholder for economic indicators
        # In production, these would come from external APIs or databases

        indicators = {
            # GDP growth rate (would be actual data in production)
            'gdp_growth_rate': 0.02,  # 2% annual growth

            # Inflation rate
            'inflation_rate': 0.06,  # 6% annual inflation

            # Currency exchange rate (TND/EUR)
            'exchange_rate_eur': 3.3,

            # Fuel price index (affects auto parts demand)
            'fuel_price_index': 1.0,
        }

        # Seasonal economic effects
        month = date_value.month

        # End of year spending surge
        if month == 12:
            indicators['seasonal_spending_factor'] = 1.2
        # Post-holiday slump
        elif month == 1:
            indicators['seasonal_spending_factor'] = 0.8
        # Normal months
        else:
            indicators['seasonal_spending_factor'] = 1.0

        return indicators


class ExternalFeaturesManager:
    """
    Manager for all external features

    Coordinates weather, economic, and other external data sources
    """

    def __init__(self):
        """Initialize external features manager"""
        self.logger = logger
        self.weather_client = WeatherAPIClient()
        self.economic_indicators = EconomicIndicators()

    async def get_features_for_date(
        self,
        date_value: date,
        city: str = "Tunis"
    ) -> Dict[str, Any]:
        """
        Get all external features for a specific date

        Args:
            date_value: Date to get features for
            city: City name for weather data

        Returns:
            Dictionary of external features
        """
        features = {}

        # Weather data (if API key is configured)
        if settings.WEATHER_API_KEY:
            try:
                weather_data = await self.weather_client.get_historical_weather(
                    city=city,
                    start_date=date_value,
                    end_date=date_value
                )
                features.update(weather_data)
            except Exception as e:
                self.logger.warning(f"Could not fetch weather data: {str(e)}")

        # Seasonal indicators
        seasonal = self.weather_client.get_seasonal_indicators(date_value)
        features.update(seasonal)

        # Economic indicators
        economic = self.economic_indicators.get_indicators(date_value)
        features.update(economic)

        # Car-specific factors
        features.update(self._get_automotive_factors(date_value))

        return features

    def _get_automotive_factors(self, date_value: date) -> Dict[str, float]:
        """
        Get automotive industry specific factors

        Args:
            date_value: Date to get factors for

        Returns:
            Automotive factors
        """
        month = date_value.month
        year = date_value.year

        factors = {}

        # Vehicle inspection season (Tunisia)
        # Typically high demand before inspection deadlines
        # Assume inspection peak in June-July and December
        factors['vehicle_inspection_season'] = 1.0 if month in [6, 7, 12] else 0.0

        # New car sales season (affects parts demand with lag)
        # New car sales typically peak in spring and fall
        factors['new_car_season'] = 1.0 if month in [3, 4, 5, 9, 10, 11] else 0.0

        # Average vehicle age factor (older fleet = more parts demand)
        # Assume gradual increase in fleet age
        current_year = datetime.now().year
        years_since_base = current_year - 2020
        factors['fleet_age_factor'] = 1.0 + (years_since_base * 0.02)

        # Tourism season (affects vehicle usage)
        # Tunisia tourism peak: June-September
        factors['tourism_season'] = 1.0 if month in [6, 7, 8, 9] else 0.5

        return factors
