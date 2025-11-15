"""
Cost protection utilities to prevent runaway API costs.

Provides tracking and limits for external API calls (Google Places, etc.)
to ensure budget stays within limits.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class APICallStats:
    """Statistics for API call tracking."""
    calls_today: int
    calls_this_month: int
    last_reset_date: datetime
    budget_exhausted: bool


class APICallTracker:
    """
    Track API calls and enforce daily/monthly limits.

    This class helps prevent runaway costs by tracking API usage
    and blocking calls when limits are reached.

    Example:
        >>> tracker = APICallTracker(
        ...     redis_client=redis,
        ...     service_name="google_places",
        ...     daily_limit=150,
        ...     monthly_limit=4500
        ... )
        >>>
        >>> if tracker.can_make_call():
        ...     result = make_api_call()
        ...     tracker.record_call()
        ... else:
        ...     logger.error("API call limit reached")
    """

    def __init__(
        self,
        redis_client,
        service_name: str,
        daily_limit: int,
        monthly_limit: int,
        warning_threshold: float = 0.8
    ):
        """
        Initialize API call tracker.

        Args:
            redis_client: Redis client for persistent storage
            service_name: Name of the API service (e.g., "google_places")
            daily_limit: Maximum calls allowed per day
            monthly_limit: Maximum calls allowed per month
            warning_threshold: Percentage to trigger warning (default: 80%)
        """
        self.redis = redis_client
        self.service_name = service_name
        self.daily_limit = daily_limit
        self.monthly_limit = monthly_limit
        self.warning_threshold = warning_threshold

        self.daily_key = f"api_calls:{service_name}:daily"
        self.monthly_key = f"api_calls:{service_name}:monthly"

    def get_stats(self) -> APICallStats:
        """Get current API call statistics."""
        calls_today = int(self.redis.get(self.daily_key) or 0)
        calls_this_month = int(self.redis.get(self.monthly_key) or 0)

        budget_exhausted = (
            calls_today >= self.daily_limit or
            calls_this_month >= self.monthly_limit
        )

        return APICallStats(
            calls_today=calls_today,
            calls_this_month=calls_this_month,
            last_reset_date=datetime.now(),
            budget_exhausted=budget_exhausted
        )

    def can_make_call(self) -> bool:
        """
        Check if an API call can be made within budget limits.

        Returns:
            True if call is allowed, False if limits exceeded
        """
        stats = self.get_stats()

        if stats.calls_today >= self.daily_limit:
            logger.error(
                f"{self.service_name} daily limit reached: "
                f"{stats.calls_today}/{self.daily_limit} calls"
            )
            return False

        if stats.calls_this_month >= self.monthly_limit:
            logger.error(
                f"{self.service_name} monthly limit reached: "
                f"{stats.calls_this_month}/{self.monthly_limit} calls"
            )
            return False

        # Check warning thresholds
        daily_pct = stats.calls_today / self.daily_limit
        monthly_pct = stats.calls_this_month / self.monthly_limit

        if daily_pct >= self.warning_threshold:
            logger.warning(
                f"{self.service_name} daily budget at {daily_pct*100:.0f}%: "
                f"{stats.calls_today}/{self.daily_limit}"
            )

        if monthly_pct >= self.warning_threshold:
            logger.warning(
                f"{self.service_name} monthly budget at {monthly_pct*100:.0f}%: "
                f"{stats.calls_this_month}/{self.monthly_limit}"
            )

        return True

    def record_call(self, count: int = 1) -> None:
        """
        Record an API call.

        Args:
            count: Number of calls to record (default: 1)
        """
        # Increment daily counter
        current_day = datetime.now().strftime("%Y-%m-%d")
        daily_key_with_date = f"{self.daily_key}:{current_day}"

        self.redis.incr(daily_key_with_date, count)
        # Expire daily counter at end of day
        self.redis.expireat(
            daily_key_with_date,
            int((datetime.now() + timedelta(days=1)).replace(
                hour=0, minute=0, second=0, microsecond=0
            ).timestamp())
        )

        # Also maintain a simple daily counter for quick checks
        self.redis.incr(self.daily_key, count)
        self.redis.expire(self.daily_key, 86400)  # 24 hours

        # Increment monthly counter
        current_month = datetime.now().strftime("%Y-%m")
        monthly_key_with_date = f"{self.monthly_key}:{current_month}"

        self.redis.incr(monthly_key_with_date, count)
        # Expire monthly counter at end of month
        next_month = (datetime.now() + timedelta(days=32)).replace(day=1)
        self.redis.expireat(
            monthly_key_with_date,
            int(next_month.timestamp())
        )

        # Also maintain simple monthly counter
        self.redis.incr(self.monthly_key, count)
        self.redis.expire(self.monthly_key, 2592000)  # 30 days

        logger.debug(f"Recorded {count} {self.service_name} API call(s)")

    def reset_counters(self) -> None:
        """Reset all counters (admin function)."""
        self.redis.delete(self.daily_key, self.monthly_key)
        logger.info(f"Reset {self.service_name} API call counters")


class CostProtector:
    """
    Global cost protection coordinator.

    Manages multiple API trackers and provides unified cost protection.

    Example:
        >>> protector = CostProtector(redis_client=redis)
        >>> protector.register_api(
        ...     "google_places",
        ...     daily_limit=150,
        ...     monthly_limit=4500
        ... )
        >>>
        >>> if protector.can_use_api("google_places"):
        ...     result = call_google_places_api()
        ...     protector.record_api_call("google_places")
    """

    def __init__(self, redis_client, enabled: bool = True):
        """
        Initialize cost protector.

        Args:
            redis_client: Redis client
            enabled: Enable cost protection (default: True)
        """
        self.redis = redis_client
        self.enabled = enabled
        self.trackers = {}

    def register_api(
        self,
        service_name: str,
        daily_limit: int,
        monthly_limit: int,
        warning_threshold: float = 0.8
    ) -> None:
        """Register an API service for cost tracking."""
        self.trackers[service_name] = APICallTracker(
            redis_client=self.redis,
            service_name=service_name,
            daily_limit=daily_limit,
            monthly_limit=monthly_limit,
            warning_threshold=warning_threshold
        )
        logger.info(
            f"Registered API cost tracker for {service_name}: "
            f"daily_limit={daily_limit}, monthly_limit={monthly_limit}"
        )

    def can_use_api(self, service_name: str) -> bool:
        """Check if API can be used within budget."""
        if not self.enabled:
            return True

        tracker = self.trackers.get(service_name)
        if not tracker:
            logger.warning(f"No cost tracker registered for {service_name}")
            return True

        return tracker.can_make_call()

    def record_api_call(self, service_name: str, count: int = 1) -> None:
        """Record an API call."""
        if not self.enabled:
            return

        tracker = self.trackers.get(service_name)
        if tracker:
            tracker.record_call(count)

    def get_all_stats(self) -> dict:
        """Get statistics for all tracked APIs."""
        return {
            name: tracker.get_stats()
            for name, tracker in self.trackers.items()
        }
