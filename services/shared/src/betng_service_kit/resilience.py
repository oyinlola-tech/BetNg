"""Per-peer circuit breakers and in-flight deduplication for outbound calls."""

from __future__ import annotations

import asyncio
import os
import time
from collections.abc import Awaitable, Callable, Hashable, Mapping
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

DEFAULT_FAILURE_THRESHOLD = 5
DEFAULT_RESET_TIMEOUT_MS = 10_000
DEFAULT_HALF_OPEN_PROBES = 1


class BreakerState(StrEnum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half-open"


class CircuitOpenError(Exception):
    def __init__(self, peer: str, retry_in: float) -> None:
        super().__init__(f"The circuit to {peer} is open.")
        self.peer = peer
        self.retry_in = retry_in


@dataclass(frozen=True)
class BreakerSettings:
    failure_threshold: int = DEFAULT_FAILURE_THRESHOLD
    reset_timeout_ms: int = DEFAULT_RESET_TIMEOUT_MS
    half_open_probes: int = DEFAULT_HALF_OPEN_PROBES

    def __post_init__(self) -> None:
        if self.failure_threshold < 1 or self.half_open_probes < 1:
            raise ValueError("Breaker thresholds must be at least 1.")
        if self.reset_timeout_ms < 1:
            raise ValueError("The breaker reset timeout must be positive.")

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> BreakerSettings:
        """Read ``RPC_BREAKER_FAILURE_THRESHOLD`` and ``RPC_BREAKER_RESET_MS``."""
        source: Mapping[str, str] = os.environ if env is None else env

        def read(name: str, default: int) -> int:
            raw = source.get(name) or ""
            try:
                return int(raw) if raw else default
            except ValueError as error:
                raise ValueError(f"{name} must be an integer.") from error

        return cls(
            failure_threshold=read(
                "RPC_BREAKER_FAILURE_THRESHOLD", DEFAULT_FAILURE_THRESHOLD
            ),
            reset_timeout_ms=read("RPC_BREAKER_RESET_MS", DEFAULT_RESET_TIMEOUT_MS),
        )


class CircuitBreaker:
    """Opens after consecutive failures, admits probes after the reset timeout."""

    def __init__(
        self,
        peer: str,
        settings: BreakerSettings | None = None,
        *,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.peer = peer
        self._settings = settings or BreakerSettings()
        self._clock = clock
        self._state = BreakerState.CLOSED
        self._failures = 0
        self._opened_at = 0.0
        self._probes = 0

    @property
    def state(self) -> BreakerState:
        if (
            self._state is BreakerState.OPEN
            and self._elapsed() >= self._settings.reset_timeout_ms / 1000
        ):
            return BreakerState.HALF_OPEN
        return self._state

    def _elapsed(self) -> float:
        return self._clock() - self._opened_at

    def before_call(self) -> None:
        state = self.state

        if state is BreakerState.OPEN:
            raise CircuitOpenError(
                self.peer, self._settings.reset_timeout_ms / 1000 - self._elapsed()
            )

        if state is BreakerState.HALF_OPEN:
            if self._state is BreakerState.OPEN:
                self._state = BreakerState.HALF_OPEN
                self._probes = 0
            if self._probes >= self._settings.half_open_probes:
                raise CircuitOpenError(self.peer, 0.0)
            self._probes += 1

    def record_success(self) -> None:
        self._state = BreakerState.CLOSED
        self._failures = 0
        self._probes = 0

    def record_failure(self) -> None:
        if self._state is BreakerState.HALF_OPEN:
            self._trip()
            return

        self._failures += 1
        if self._failures >= self._settings.failure_threshold:
            self._trip()

    def release_probe(self) -> None:
        if self._state is BreakerState.HALF_OPEN and self._probes > 0:
            self._probes -= 1

    def _trip(self) -> None:
        self._state = BreakerState.OPEN
        self._opened_at = self._clock()
        self._failures = 0
        self._probes = 0


_BREAKERS: dict[str, CircuitBreaker] = {}


def breaker_for(peer: str, settings: BreakerSettings | None = None) -> CircuitBreaker:
    """Every client of one peer in this process shares that peer's breaker."""
    breaker = _BREAKERS.get(peer)
    if breaker is None:
        breaker = CircuitBreaker(peer, settings or BreakerSettings.from_env())
        _BREAKERS[peer] = breaker
    return breaker


def reset_breakers() -> None:
    _BREAKERS.clear()


class InFlightDeduplicator[T]:
    """Identical concurrent calls share one execution and its outcome.

    The shared call runs as its own task, so one caller cancelling does not
    cancel it for the others.
    """

    def __init__(self) -> None:
        self._inflight: dict[Hashable, asyncio.Future[T]] = {}

    def pending(self) -> int:
        return len(self._inflight)

    async def run(self, key: Hashable, call: Callable[[], Awaitable[T]]) -> T:
        task = self._inflight.get(key)
        if task is None:
            task = asyncio.ensure_future(call())
            self._inflight[key] = task
            task.add_done_callback(lambda done: self._settle(key, done))
        return await asyncio.shield(task)

    def _settle(self, key: Hashable, done: asyncio.Future[T]) -> None:
        if self._inflight.get(key) is done:
            del self._inflight[key]
        if not done.cancelled():
            done.exception()


def freeze_params(params: Mapping[str, Any] | None) -> tuple[tuple[str, str], ...]:
    if not params:
        return ()
    return tuple(sorted((str(key), str(value)) for key, value in params.items()))
