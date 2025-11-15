"""
Orion Agent Configuration
Settings and environment variables for the demand forecasting service
"""
import os
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""

    # App info
    APP_NAME: str = "Orion Agent"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # Server
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8002"))

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/shabou_autopieces"
    )

    # Redis (for caching and task queues)
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/2")

    # Celery
    CELERY_BROKER_URL: str = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
    CELERY_RESULT_BACKEND: str = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")

    # Forecasting settings
    MIN_HISTORY_DAYS: int = 365  # Minimum 1 year of data
    FORECAST_HORIZON_DAYS: int = 30  # Default forecast horizon
    CONFIDENCE_LEVEL: float = 0.95  # 95% confidence intervals
    MODEL_RETRAIN_DAYS: int = 7  # Retrain models weekly

    # Model hyperparameters
    SARIMA_ORDER: tuple = (1, 1, 1)  # (p, d, q)
    SARIMA_SEASONAL_ORDER: tuple = (1, 1, 1, 12)  # (P, D, Q, s)
    PROPHET_CHANGEPOINT_PRIOR_SCALE: float = 0.05
    PROPHET_SEASONALITY_PRIOR_SCALE: float = 10.0

    # Weather API (optional for external features)
    WEATHER_API_KEY: Optional[str] = os.getenv("WEATHER_API_KEY")
    WEATHER_API_URL: str = "https://api.openweathermap.org/data/2.5"

    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    # Email/SMTP settings (for insights and alerts)
    SMTP_HOST: str = os.getenv("SMTP_HOST", "localhost")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: Optional[str] = os.getenv("SMTP_USER")
    SMTP_PASSWORD: Optional[str] = os.getenv("SMTP_PASSWORD")
    SMTP_USE_TLS: bool = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
    FROM_EMAIL: str = os.getenv("FROM_EMAIL", "orion@shabou-autopieces.tn")
    FROM_NAME: str = os.getenv("FROM_NAME", "Orion Agent")
    ALERT_RECIPIENTS: str = os.getenv(
        "ALERT_RECIPIENTS",
        "inventory@shabou-autopieces.tn"
    )  # Comma-separated email addresses

    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()
