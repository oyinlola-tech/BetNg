"""The contracts the odds handlers are written against.

The repository and every peer are protocols so a test can swap any one of
them. The split that matters: the simulation service owns *probability*, the
odds service owns *price*. Nothing here can decide how likely an outcome is,
and nothing here takes a user, a stake or a shop.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from decimal import Decimal
from typing import Protocol

from ..dtos import ProbabilityMatrix, TeamStrength
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

#: Given the locked market, return its next status or raise a domain error.
StatusDecision = Callable[[MarketRecord], str]
#: Runs inside the transaction; raising rolls the change back.
MarketCommitGuard = Callable[[MarketRecord, MarketRecord], Awaitable[None]]
ConfigurationCommitGuard = Callable[
    [ConfigurationRecord, ConfigurationRecord], Awaitable[None]
]


class OddsRepository(Protocol):
    """Reads and writes of the ``odds`` schema."""

    async def get_active_configuration(self) -> ConfigurationRecord:
        """Return the pricing configuration new markets are priced under."""
        ...

    async def insert_configuration(
        self,
        margins: dict[str, Decimal],
        min_odds: Decimal,
        max_odds: Decimal,
        created_by: str,
        reason: str,
        before_commit: ConfigurationCommitGuard,
    ) -> ConfigurationRecord:
        """Store the next configuration version and make it the active one."""
        ...

    async def find_publication(self, match_id: str) -> PublishOutcome | None:
        """Return what is already published for a match, if anything."""
        ...

    async def publish_markets(
        self,
        match_id: str,
        markets: tuple[PricedMarket, ...],
        pricing_version: int,
        model_version: str,
        model_configuration_version: int,
    ) -> PublishOutcome:
        """Create a match's markets, selections and INITIAL snapshots once."""
        ...

    async def set_match_markets_status(
        self, match_id: str, status: str, allowed_from: frozenset[str]
    ) -> int:
        """Move a match's markets to ``status``; return how many moved."""
        ...

    async def change_market_status(
        self,
        market_id: str,
        decide: StatusDecision,
        before_commit: MarketCommitGuard,
    ) -> MarketRecord | None:
        """Change one market's status under a row lock; ``None`` if absent."""
        ...

    async def get_market(self, market_id: str) -> MarketRecord | None:
        """Return one market with its selections."""
        ...

    async def list_markets(self, match_ids: list[str]) -> list[MarketRecord]:
        """Return every market of the given matches, in display order."""
        ...

    async def list_trading_markets(self, limit: int) -> list[MarketRecord]:
        """Return markets that are not yet settled or void, newest match first."""
        ...

    async def list_snapshots(self, market_id: str) -> list[SnapshotRecord]:
        """Return a market's snapshot history, oldest first."""
        ...

    async def opening_odds(self, market_ids: list[str]) -> dict[str, Decimal]:
        """Return each selection's version-1 price, keyed by selection id."""
        ...


class ProbabilityModel(Protocol):
    """The simulation service, as the odds service sees it."""

    async def calculate(
        self, home: TeamStrength, away: TeamStrength, request_id: str | None
    ) -> ProbabilityMatrix:
        """Return the score matrix for a pairing, or raise ``ODDS_UNAVAILABLE``."""
        ...

    async def ping(self) -> None:
        """Raise unless the simulation service is reachable."""
        ...


class EventPublisher(Protocol):
    """The event service's ``event.publish``."""

    async def publish_odds_updated(
        self, match_id: str, description: str, request_id: str | None
    ) -> None:
        """Announce that a match's odds changed."""
        ...


class AuditRecorder(Protocol):
    """The identity service's ``identity.recordAudit``."""

    async def record(self, entry: AuditEntry) -> None:
        """Write one audit entry, or raise if it cannot be written."""
        ...


class MatchDirectory(Protocol):
    """Read-only view of the ``match`` schema."""

    async def find(self, match_ids: list[str]) -> dict[str, MatchInfo]:
        """Return the known matches among ``match_ids``, keyed by id."""
        ...


class ExposureReader(Protocol):
    """Read-only view of pending bets in the ``betting`` schema."""

    async def by_selection(self, market_ids: list[str]) -> dict[str, SelectionExposure]:
        """Return pending stake and liability per selection id."""
        ...
