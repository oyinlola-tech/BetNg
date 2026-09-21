from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any

from ..engine import DecisionKind, Limits, RiskReason


@dataclass(frozen=True)
class LimitsRecord:
    limits: Limits
    created_at: datetime
    created_by: str
    reason: str


@dataclass(frozen=True)
class LimitsDraft:
    min_stake: int
    max_stake_per_bet: int
    max_payout_per_bet: int
    max_liability_per_selection: int
    max_liability_per_market: int
    max_liability_per_match: int


@dataclass(frozen=True)
class DecisionRecord:
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
    match_id: str
    league_name: str
    match_label: str
    kickoff_at: datetime
    lifecycle: str
    frozen_at: datetime | None


@dataclass(frozen=True)
class MarketRow:
    market_id: str
    match_id: str
    type: str
    line: Decimal | None


@dataclass(frozen=True)
class SelectionRow:
    selection_id: str
    market_id: str
    code: str
    label: str
    odds: Decimal


@dataclass(frozen=True)
class SelectionBookRow:
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
    match_id: str
    market_id: str
    market_type: str
    bets: int
    stake: int


@dataclass(frozen=True)
class MatchBookRow:
    match_id: str
    bets: int
    stake: int


@dataclass(frozen=True)
class BookRows:
    selections: tuple[SelectionBookRow, ...] = ()
    markets: tuple[MarketBookRow, ...] = ()
    matches: tuple[MatchBookRow, ...] = ()


@dataclass(frozen=True)
class BookTotals:
    bets: int
    stake: int
    payout: int


@dataclass(frozen=True)
class MarketTypeRow:
    market_type: str
    market_label: str
    stake: int


@dataclass(frozen=True)
class DecisionTally:
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
