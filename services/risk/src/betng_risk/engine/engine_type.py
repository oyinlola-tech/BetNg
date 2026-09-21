"""The decision engine's inputs and output.

Plain frozen values: the engine sees a slip, the limits in force, what the
database says about each leg, and the global book. It is never handed a bettor,
a shop or a cashier, so it cannot treat one caller differently from another.
"""

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
    """What the database holds for one selection id.

    ``match_lifecycle`` and ``betting_closes_at`` are ``None`` when the market
    points at a match that does not exist.
    """

    selection_id: str
    market_id: str
    match_id: str
    market_status: str
    match_lifecycle: str | None
    betting_closes_at: datetime | None
    frozen: bool = False


@dataclass(frozen=True)
class MarketBook:
    """The pending book on one market, over every account and channel."""

    market_id: str
    match_id: str
    #: Σ stake of pending bets with a leg on this market, each bet once.
    stake: int
    #: Σ potential payout of pending bets, per selection id.
    payouts: Mapping[str, int] = field(default_factory=dict)

    def net(self, selection_id: str) -> int:
        """What the book loses on this market if the selection wins."""
        return self.payouts.get(selection_id, 0) - self.stake

    def worst_case(self) -> int:
        if not self.payouts:
            return 0

        return max(payout - self.stake for payout in self.payouts.values())


@dataclass(frozen=True)
class ExposureBook:
    """Global pending exposure for the matches a slip touches."""

    #: Σ(potential_payout − stake) per selection id.
    selection_liability: Mapping[str, int] = field(default_factory=dict)
    #: Every market of those matches that carries a pending bet.
    markets: Mapping[str, MarketBook] = field(default_factory=dict)


@dataclass(frozen=True)
class EngineDecision:
    decision: DecisionKind
    reason: RiskReason
    max_stake: int
