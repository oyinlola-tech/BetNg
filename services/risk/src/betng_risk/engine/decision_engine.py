"""The stake decision: ACCEPT, LIMIT or REJECT, with the largest stake allowed.

Pure: no clock, no database, no network. The caller supplies the instant, the
leg states and the global book. The engine's whole vocabulary is a stake — it
has no way to name a price, a match outcome or a bettor.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime

from .engine_type import (
    EngineDecision,
    ExposureBook,
    Limits,
    RiskReason,
    SelectionState,
    SlipLeg,
)
from .exposure_math import largest_stake, odds_fraction, potential_payout

OPEN_LIFECYCLES = frozenset({"BETTING_OPEN", "BETTING_ACTIVE"})
MARKET_OPEN = "OPEN"
MARKET_SUSPENDED = "SUSPENDED"


def _reject(reason: RiskReason) -> EngineDecision:
    return EngineDecision(decision="REJECT", reason=reason, max_stake=0)


def _known_state(
    leg: SlipLeg, states: Mapping[str, SelectionState]
) -> SelectionState | None:
    """The leg's state, or ``None`` when the leg does not describe real rows."""
    state = states.get(leg.selection_id)

    if (
        state is None
        or state.market_id != leg.market_id
        or state.match_id != leg.match_id
        or state.match_lifecycle is None
        or state.betting_closes_at is None
    ):
        return None

    return state


def _betting_closed(state: SelectionState, now: datetime) -> bool:
    return (
        state.frozen
        or state.match_lifecycle not in OPEN_LIFECYCLES
        or state.betting_closes_at is None
        or state.betting_closes_at <= now
    )


def _state_rejection(
    legs: Sequence[SlipLeg],
    states: Mapping[str, SelectionState],
    now: datetime,
) -> RiskReason | None:
    known = [_known_state(leg, states) for leg in legs]
    resolved = [state for state in known if state is not None]

    if any(_betting_closed(state, now) for state in resolved):
        return "MARKET_CLOSED"
    if any(state.market_status == MARKET_SUSPENDED for state in resolved):
        return "MARKET_SUSPENDED"
    if any(state.market_status != MARKET_OPEN for state in resolved):
        return "MARKET_CLOSED"

    selection_ids = [leg.selection_id for leg in legs]
    if len(resolved) != len(legs) or len(set(selection_ids)) != len(legs):
        return "INVALID_SELECTION"

    return None


@dataclass(frozen=True)
class _TouchedMarket:
    """One market the slip backs, reduced to what a new stake can move."""

    #: Net exposure of each selection the slip backs on this market.
    backed_nets: tuple[int, ...]
    #: Positive worst case among the selections the slip does not back. The
    #: relief a new stake gives those selections is ignored, which keeps the
    #: match figure monotone in the stake and errs on the side of the book.
    floor: int

    def worst_case(self, added_liability: int) -> int:
        return max(self.floor, *(net + added_liability for net in self.backed_nets))


@dataclass(frozen=True)
class _MatchView:
    untouched: int
    touched: tuple[_TouchedMarket, ...]

    def worst_case(self, added_liability: int) -> int:
        return self.untouched + sum(
            market.worst_case(added_liability) for market in self.touched
        )


def _match_views(legs: Sequence[SlipLeg], book: ExposureBook) -> list[_MatchView]:
    backed: dict[str, dict[str, set[str]]] = {}
    for leg in legs:
        backed.setdefault(leg.match_id, {}).setdefault(leg.market_id, set()).add(
            leg.selection_id
        )

    views: list[_MatchView] = []
    for match_id, markets in backed.items():
        untouched = sum(
            max(0, market.worst_case())
            for market in book.markets.values()
            if market.match_id == match_id and market.market_id not in markets
        )

        touched: list[_TouchedMarket] = []
        for market_id, selection_ids in markets.items():
            market = book.markets.get(market_id)
            others = (
                [
                    market.net(selection_id)
                    for selection_id in market.payouts
                    if selection_id not in selection_ids
                ]
                if market is not None
                else []
            )
            touched.append(
                _TouchedMarket(
                    backed_nets=tuple(
                        market.net(selection_id) if market is not None else 0
                        for selection_id in sorted(selection_ids)
                    ),
                    floor=max(0, *others) if others else 0,
                )
            )

        views.append(_MatchView(untouched=untouched, touched=tuple(touched)))

    return views


def decide(
    *,
    stake: int,
    legs: Sequence[SlipLeg],
    limits: Limits,
    states: Mapping[str, SelectionState],
    book: ExposureBook,
    now: datetime,
) -> EngineDecision:
    """Decide one slip against the limits and the global pending book."""
    rejection = _state_rejection(legs, states, now)
    if rejection is not None:
        return _reject(rejection)

    if stake < limits.min_stake:
        return _reject("STAKE_BELOW_MINIMUM")

    numerator, denominator = odds_fraction([leg.odds for leg in legs])

    stake_cap = limits.max_stake_per_bet
    payout_cap = limits.max_payout_per_bet * denominator // numerator
    upper = min(stake_cap, payout_cap)
    binding: RiskReason = "STAKE_LIMIT" if stake_cap <= payout_cap else "PAYOUT_LIMIT"

    selection_liabilities = [
        book.selection_liability.get(leg.selection_id, 0) for leg in legs
    ]
    backed_nets = [
        market.net(leg.selection_id) if market is not None else 0
        for leg in legs
        for market in [book.markets.get(leg.market_id)]
    ]
    matches = _match_views(legs, book)
    # A match already over its limit still takes a stake that does not raise
    # its worst case; it takes nothing that does.
    match_ceilings = [
        max(limits.max_liability_per_match, match.worst_case(0)) for match in matches
    ]

    def within_exposure(candidate: int) -> bool:
        added = potential_payout(candidate, numerator, denominator) - candidate

        return (
            all(
                liability + added <= limits.max_liability_per_selection
                for liability in selection_liabilities
            )
            and all(net + added <= limits.max_liability_per_market for net in backed_nets)
            and all(
                match.worst_case(added) <= ceiling
                for match, ceiling in zip(matches, match_ceilings, strict=True)
            )
        )

    max_stake = largest_stake(within_exposure, upper)
    if max_stake < upper:
        binding = "EXPOSURE_LIMIT"

    if max_stake >= stake:
        return EngineDecision(
            decision="ACCEPT", reason="WITHIN_LIMIT", max_stake=max_stake
        )

    if max_stake >= limits.min_stake:
        return EngineDecision(decision="LIMIT", reason=binding, max_stake=max_stake)

    return _reject(binding)
