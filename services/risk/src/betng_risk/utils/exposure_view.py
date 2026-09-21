"""Turns pending-book rows into the engine's book and dashboard shapes."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from ..dtos import (
    ExposureStatus,
    MarketExposure,
    MatchExposure,
    SelectionExposureRow,
)
from ..engine import ExposureBook, Limits, MarketBook, utilisation_status
from ..types import BookRows, MarketRow, MatchRow, SelectionRow


def to_exposure_book(rows: BookRows) -> ExposureBook:
    """Shape the pending book the way the decision engine reads it."""
    payouts: dict[str, dict[str, int]] = {}
    for selection in rows.selections:
        payouts.setdefault(selection.market_id, {})[selection.selection_id] = (
            selection.payout
        )

    return ExposureBook(
        selection_liability={
            selection.selection_id: selection.payout - selection.stake
            for selection in rows.selections
        },
        markets={
            market.market_id: MarketBook(
                market_id=market.market_id,
                match_id=market.match_id,
                stake=market.stake,
                payouts=payouts.get(market.market_id, {}),
            )
            for market in rows.markets
        },
    )


def match_worst_case(match_id: str, book: ExposureBook) -> int:
    """Sum of the positive worst cases of the match's markets."""
    return sum(
        max(0, market.worst_case())
        for market in book.markets.values()
        if market.match_id == match_id
    )


def build_match_exposure(
    match: MatchRow,
    markets: Sequence[MarketRow],
    selections: Sequence[SelectionRow],
    rows: BookRows,
    limits: Limits,
) -> MatchExposure:
    """Assemble a match's exposure; status follows its most utilised limit."""
    book = to_exposure_book(rows)
    selection_books = {
        row.selection_id: row
        for row in rows.selections
        if row.match_id == match.match_id
    }
    utilisation: list[tuple[int, int]] = []
    market_views: list[MarketExposure] = []

    for market in markets:
        if market.match_id != match.match_id:
            continue

        market_book = book.markets.get(market.market_id)
        if market_book is None:
            continue

        selection_views: list[SelectionExposureRow] = []
        for selection in selections:
            if selection.market_id != market.market_id:
                continue

            backed = selection_books.get(selection.selection_id)
            stake = backed.stake if backed is not None else 0
            payout = backed.payout if backed is not None else 0
            net = payout - market_book.stake
            pairs = [
                (payout - stake, limits.max_liability_per_selection),
                (net, limits.max_liability_per_market),
            ]
            utilisation.extend(pairs)
            selection_views.append(
                SelectionExposureRow(
                    selection_id=UUID(selection.selection_id),
                    code=selection.code,
                    label=selection.label,
                    odds=selection.odds,
                    bets=backed.bets if backed is not None else 0,
                    customers=backed.customers if backed is not None else 0,
                    shops=backed.shops if backed is not None else 0,
                    total_stake=stake,
                    potential_payout=payout,
                    net_exposure=net,
                    status=utilisation_status(pairs),
                )
            )

        market_views.append(
            MarketExposure(
                market_id=UUID(market.market_id),
                type=market.type,
                line=market.line,
                total_stake=market_book.stake,
                worst_case_exposure=market_book.worst_case(),
                selections=selection_views,
            )
        )

    worst_case = match_worst_case(match.match_id, book)
    utilisation.append((worst_case, limits.max_liability_per_match))
    match_book = next(
        (row for row in rows.matches if row.match_id == match.match_id), None
    )
    status: ExposureStatus = (
        "FROZEN" if match.frozen_at is not None else utilisation_status(utilisation)
    )

    return MatchExposure(
        match_id=UUID(match.match_id),
        league_name=match.league_name,
        match_label=match.match_label,
        kickoff_at=match.kickoff_at,
        lifecycle=match.lifecycle,
        frozen_at=match.frozen_at,
        bets=match_book.bets if match_book is not None else 0,
        total_stake=match_book.stake if match_book is not None else 0,
        worst_case_exposure=worst_case,
        status=status,
        markets=market_views,
    )


def frozen_match_exposure(match: MatchRow, snapshot: object) -> MatchExposure:
    """Serve the book as it stood at close, under the match's current state."""
    frozen = MatchExposure.model_validate(snapshot)

    return frozen.model_copy(
        update={
            "lifecycle": match.lifecycle,
            "frozen_at": match.frozen_at,
            "status": "FROZEN",
        }
    )
