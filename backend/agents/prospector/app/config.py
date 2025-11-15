"""
Prospector Agent Configuration
Settings and environment variables for the lead generation service
"""
import os
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""

    # App info
    APP_NAME: str = "Prospector Agent"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # Server
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8001"))

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/shabou_autopieces"
    )

    # Redis (for caching and task queues)
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/1")

    # Celery
    CELERY_BROKER_URL: str = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
    CELERY_RESULT_BACKEND: str = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")

    # Google Places API
    GOOGLE_PLACES_API_KEY: Optional[str] = os.getenv("GOOGLE_PLACES_API_KEY")

    # Scraping settings
    SCRAPING_USER_AGENT: str = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/91.0.4472.124 Safari/537.36"
    )
    SCRAPING_TIMEOUT: int = 30
    SCRAPING_MAX_RETRIES: int = 3

    # Lead scoring
    MIN_POTENTIAL_SCORE: int = 0
    MAX_POTENTIAL_SCORE: int = 100

    # Rate limiting
    GOOGLE_API_RATE_LIMIT: int = 10  # requests per second
    SCRAPING_RATE_LIMIT: int = 5  # requests per second

    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()
