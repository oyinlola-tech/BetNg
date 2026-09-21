"""Row shapes the repository returns. Amounts are kobo; odds are decimals."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any

from ..engine import DecisionKind, Limits, RiskReason


@dataclass(frozen=True)
class LimitsRecord:
    """One ``risk.risk_limits`` row."""

    limits: Limits
    created_at: datetime
    created_by: str
    reason: str


@dataclass(frozen=True)
class LimitsDraft:
    """The amounts of a limits version that does not exist yet."""

    min_stake: int
    max_stake_per_bet: int
    max_payout_per_bet: int
    max_liability_per_selection: int
    max_liability_per_market: int
    max_liability_per_match: int


@dataclass(frozen=True)
class DecisionRecord:
    """One ``risk.risk_decisions`` row, as inserted."""

    id: str
    request_id: str
    actor_kind: str
    actor_id: str
    shop_id: str | None
    stake_requested: int
    total_odds: Decimal
    decision: DecisionKind
    reason: RiskReason
    max_stake: int
    legs: list[dict[str, Any]]
    limits_version: int


@dataclass(frozen=True)
class MatchRow:
    """A match as the dashboard names it."""

    match_id: str
    league_name: str
    match_label: str
    kickoff_at: datetime
    lifecycle: str
    frozen_at: datetime | None


@dataclass(frozen=True)
class MarketRow:
    """One ``odds.markets`` row."""

    market_id: str
    match_id: str
    type: str
    line: Decimal | None


@dataclass(frozen=True)
class SelectionRow:
    """One ``odds.market_selections`` row."""

    selection_id: str
    market_id: str
    code: str
    label: str
    odds: Decimal


@dataclass(frozen=True)
class SelectionBookRow:
    """Pending bets with a leg on one selection, over every account."""

    match_id: str
    market_id: str
    selection_id: str
    bets: int
    customers: int
    shops: int
    stake: int
    payout: int


@dataclass(frozen=True)
class MarketBookRow:
    """Pending bets with a leg on one market, each bet counted once."""

    match_id: str
    market_id: str
    market_type: str
    bets: int
    stake: int


@dataclass(frozen=True)
class MatchBookRow:
    """Pending bets with a leg on one match, each bet counted once."""

    match_id: str
    bets: int
    stake: int


@dataclass(frozen=True)
class BookRows:
    """The pending book at its three grains, read in one snapshot."""

    selections: tuple[SelectionBookRow, ...] = ()
    markets: tuple[MarketBookRow, ...] = ()
    matches: tuple[MatchBookRow, ...] = ()


@dataclass(frozen=True)
class BookTotals:
    """Every pending bet on the platform, each counted once."""

    bets: int
    stake: int
    payout: int


@dataclass(frozen=True)
class MarketTypeRow:
    """Pending stake by market type, each bet counted once per type."""

    market_type: str
    market_label: str
    stake: int


@dataclass(frozen=True)
class DecisionTally:
    """Stored decisions by kind over a window."""

    accepted: int
    limited: int
    rejected: int


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
