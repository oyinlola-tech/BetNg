from __future__ import annotations

from collections.abc import Awaitable, Callable
from decimal import Decimal
from typing import Protocol

from ..dtos import MatchState, ProbabilityMatrix, TeamStrength
from ..pricing import PricedMarket
from ..types import (
    AuditEntry,
    ConfigurationRecord,
    MarketRecord,
    MatchInfo,
    PublishOutcome,
    SelectionExposure,
    SnapshotRecord,
)

StatusDecision = Callable[[MarketRecord], str]
#: Runs inside the transaction; raising rolls the change back.
MarketCommitGuard = Callable[[MarketRecord, MarketRecord], Awaitable[None]]
ConfigurationCommitGuard = Callable[
    [ConfigurationRecord, ConfigurationRecord], Awaitable[None]
]


class OddsRepository(Protocol):
    async def get_active_configuration(self) -> ConfigurationRecord: ...

    async def insert_configuration(
        self,
        margins: dict[str, Decimal],
        min_odds: Decimal,
        max_odds: Decimal,
        created_by: str,
        reason: str,
        before_commit: ConfigurationCommitGuard,
    ) -> ConfigurationRecord: ...

    async def find_publication(self, match_id: str) -> PublishOutcome | None: ...

    async def publish_markets(
        self,
        match_id: str,
        markets: tuple[PricedMarket, ...],
        pricing_version: int,
        model_version: str,
        model_configuration_version: int,
    ) -> PublishOutcome: ...

    async def set_match_markets_status(
        self, match_id: str, status: str, allowed_from: frozenset[str]
    ) -> int: ...

    async def change_market_status(
        self,
        market_id: str,
        decide: StatusDecision,
        before_commit: MarketCommitGuard,
    ) -> MarketRecord | None:
        """Change one market's status under a row lock; ``None`` if absent."""
        ...

    async def get_market(self, market_id: str) -> MarketRecord | None: ...

    async def list_markets(self, match_ids: list[str]) -> list[MarketRecord]: ...

    async def list_trading_markets(self, limit: int) -> list[MarketRecord]: ...

    async def list_snapshots(self, market_id: str, limit: int) -> list[SnapshotRecord]:
        """Return up to ``limit`` of a market's snapshots, oldest first."""
        ...

    async def opening_odds(self, market_ids: list[str]) -> dict[str, Decimal]: ...

    async def record_snapshot(
        self, match_id: str, odds_version: int, reason: str
    ) -> None:
        """Record an odds snapshot for all markets of a match."""
        ...


class ProbabilityModel(Protocol):
    async def calculate(
        self,
        match_id: str,
        home: TeamStrength,
        away: TeamStrength,
        request_id: str | None,
        state: MatchState | None = None,
    ) -> ProbabilityMatrix: ...

    async def ping(self) -> None: ...


class EventPublisher(Protocol):
    async def publish_odds_updated(
        self, match_id: str, description: str, request_id: str | None
    ) -> None: ...


class AuditRecorder(Protocol):
    """The identity service's ``identity.recordAudit``."""

    async def record(self, entry: AuditEntry) -> None:
        """Write one audit entry, or raise if it cannot be written."""
        ...


class MatchDirectory(Protocol):
    async def find(self, match_ids: list[str]) -> dict[str, MatchInfo]: ...


class ExposureReader(Protocol):
    async def by_selection(
        self, market_ids: list[str]
    ) -> dict[str, SelectionExposure]: ...
