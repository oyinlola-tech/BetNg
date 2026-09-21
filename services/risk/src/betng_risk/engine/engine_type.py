from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Literal

DecisionKind = Literal["ACCEPT", "LIMIT", "REJECT"]

RiskReason = Literal[
    "WITHIN_LIMIT",
    "STAKE_LIMIT",
    "PAYOUT_LIMIT",
    "EXPOSURE_LIMIT",
    "MARKET_CLOSED",
    "MARKET_SUSPENDED",
    "STAKE_BELOW_MINIMUM",
    "INVALID_SELECTION",
]


@dataclass(frozen=True)
class SlipLeg:
    match_id: str
    market_id: str
    selection_id: str
    odds: Decimal


@dataclass(frozen=True)
class Limits:
    """One row of ``risk.risk_limits``; every amount is kobo."""

    version: int
    min_stake: int
    max_stake_per_bet: int
    max_payout_per_bet: int
    max_liability_per_selection: int
    max_liability_per_market: int
    max_liability_per_match: int


@dataclass(frozen=True)
class SelectionState:
    selection_id: str
    market_id: str
    match_id: str
    market_status: str
    match_lifecycle: str | None
    betting_closes_at: datetime | None
    frozen: bool = False


@dataclass(frozen=True)
class MarketBook:
    market_id: str
    match_id: str
    #: Each pending bet's stake counted once, however many legs it has here.
    stake: int
    payouts: Mapping[str, int] = field(default_factory=dict)

    def net(self, selection_id: str) -> int:
        return self.payouts.get(selection_id, 0) - self.stake

    def worst_case(self) -> int:
        """Return the largest net exposure, or 0 for an empty market."""
        if not self.payouts:
            return 0

        return max(payout - self.stake for payout in self.payouts.values())


@dataclass(frozen=True)
class ExposureBook:
    """Global pending exposure for the matches a slip touches."""

    #: Sum of (potential_payout - stake) per selection id.
    selection_liability: Mapping[str, int] = field(default_factory=dict)
    markets: Mapping[str, MarketBook] = field(default_factory=dict)


@dataclass(frozen=True)
class EngineDecision:
    decision: DecisionKind
    reason: RiskReason
    max_stake: int
