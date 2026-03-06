"""
cache.py – Simple in-memory TTL cache (mirrors src/lib/api-cache.ts)
"""
import time
from typing import Any, Optional

TTL_SECONDS = 300  # 5 minutes


class ApiCache:
    def __init__(self) -> None:
        self._store: dict[str, tuple[Any, float]] = {}

    def get(self, key: str) -> Optional[Any]:
        entry = self._store.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if time.time() > expires_at:
            self._store.pop(key, None)
            return None
        return value

    def set(self, key: str, value: Any, ttl: int = TTL_SECONDS) -> None:
        self._store[key] = (value, time.time() + ttl)

    def clear(self, key: Optional[str] = None) -> None:
        if key:
            self._store.pop(key, None)
        else:
            self._store.clear()


api_cache = ApiCache()
