from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Awaitable, Callable

import psycopg

from ..types import LimitsRecord

LIMITS_CHANNEL = "risk_limits_changed"
RECONNECT_SECONDS = 1.0


class LimitsCache:
    """Holds the limits in force for ``ttl`` seconds while changes are heard."""

    def __init__(
        self, ttl_seconds: float, *, clock: Callable[[], float] = time.monotonic
    ) -> None:
        self._ttl = ttl_seconds
        self._clock = clock
        self._record: LimitsRecord | None = None
        self._stored_at = 0.0
        self._generation = 0
        self._listening = False

    @property
    def enabled(self) -> bool:
        return self._ttl > 0

    def set_listening(self, listening: bool) -> None:
        self._listening = listening
        self.invalidate()

    def invalidate(self) -> None:
        self._generation += 1
        self._record = None

    def generation(self) -> int:
        return self._generation

    def get(self) -> LimitsRecord | None:
        if (
            not self.enabled
            or not self._listening
            or self._record is None
            or self._clock() - self._stored_at >= self._ttl
        ):
            return None
        return self._record

    def store(self, record: LimitsRecord, generation: int) -> None:
        """Keep a read only if no change landed while it was in flight."""
        if self.enabled and self._listening and generation == self._generation:
            self._record = record
            self._stored_at = self._clock()


async def listen_for_limit_changes(
    database_url: str,
    cache: LimitsCache,
    logger: logging.Logger,
    *,
    on_listening: Callable[[], Awaitable[None]] | None = None,
) -> None:
    """Run until cancelled; while disconnected the cache stays bypassed."""
    while True:
        try:
            async with await psycopg.AsyncConnection.connect(
                database_url, autocommit=True
            ) as connection:
                await connection.execute(f"LISTEN {LIMITS_CHANNEL}")
                cache.set_listening(True)
                if on_listening is not None:
                    await on_listening()
                async for _ in connection.notifies():
                    cache.invalidate()
        except asyncio.CancelledError:
            cache.set_listening(False)
            raise
        except (psycopg.Error, OSError) as error:
            cache.set_listening(False)
            logger.warning(
                "Limits change listener lost; limits are read uncached",
                extra={"event": "limits_listener_down", "error": type(error).__name__},
            )
        cache.set_listening(False)
        await asyncio.sleep(RECONNECT_SECONDS)
