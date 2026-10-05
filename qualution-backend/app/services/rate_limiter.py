import time
from collections import defaultdict
from typing import Dict, List
from fastapi import HTTPException, status
from app.core.config import settings

class InMemoryRateLimiter:
    """
    Sliding window in-memory rate limiter per user.
    Tracks timestamps per key (e.g. 'submission:usr-123', 'report:usr-123').
    """
    def __init__(self):
        self._events: Dict[str, List[float]] = defaultdict(list)

    def check_rate_limit(self, key: str, max_requests: int, window_seconds: float, action_name: str = "action"):
        now = time.time()
        cutoff = now - window_seconds
        
        # Clean older entries
        self._events[key] = [t for t in self._events[key] if t > cutoff]
        
        if len(self._events[key]) >= max_requests:
            retry_after = int(self._events[key][0] + window_seconds - now) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded for {action_name}. Please wait {retry_after} seconds before trying again."
            )
        
        self._events[key].append(now)

rate_limiter = InMemoryRateLimiter()
