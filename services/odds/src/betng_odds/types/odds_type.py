"""The rows and read-model records the service passes between its layers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any

from ..pricing import PricingConfiguration


@dataclass(frozen=True)
class ConfigurationRecord:
    """A stored pricing configuration with its provenance."""

    pricing: PricingConfiguration
    active: bool
    created_at: datetime
    created_by: str
    reason: str


@dataclass(frozen=True)
class SelectionRecord:
    """One row of ``odds.market_selections``."""

    id: str
    market_id: str
    match_id: str
    code: str
    label: str
    probability: Decimal
    odds: Decimal
    sort_order: int


@dataclass(frozen=True)
class MarketRecord:
    """One row of ``odds.markets`` with its selections in display order."""

    id: str
    match_id: str
    type: str
    line: Decimal | None
    status: str
    odds_version: int
    created_at: datetime
    updated_at: datetime
    selections: tuple[SelectionRecord, ...]


@dataclass(frozen=True)
class SnapshotRecord:
    """One row of ``odds.odds_snapshots``."""

    id: str
    market_id: str
    match_id: str
    odds_version: int
    reason: str
    prices: list[dict[str, Any]]
    created_at: datetime


@dataclass(frozen=True)
class PublishOutcome:
    """What ``publish_markets`` found or created for a match."""

    match_id: str
    markets: int
    odds_version: int
    created: bool


@dataclass(frozen=True)
class MatchInfo:
    """What the odds service reads about a match from the ``match`` schema."""

    match_id: str
    home_name: str
    away_name: str
    home_short_name: str
    away_short_name: str
    league_name: str
    lifecycle: str
    betting_closes_at: datetime

    @property
    def label(self) -> str:
        """The match as the admin console titles it."""
        return f"{self.home_name} v {self.away_name}"


@dataclass(frozen=True)
class SelectionExposure:
    """Pending stake and liability on one selection, in kobo."""

    stake: int
    liability: int


@dataclass(frozen=True)
class AuditEntry:
    """The payload of ``identity.recordAudit``."""

    actor_id: str
    actor_role: str
    action: str
    entity_type: str
    entity_id: str
    before: dict[str, Any]
    after: dict[str, Any]
    reason: str
    severity: str
    request_id: str
