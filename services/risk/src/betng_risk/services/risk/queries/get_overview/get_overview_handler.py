"""Reads the risk overview."""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timedelta
from uuid import UUID

from betng_service_kit import QueryHandler

from .....constants import DECISION_WINDOW_HOURS, RiskQuery
from .....dtos import (
    DecisionCounts,
    MarketTypeExposure,
    MatchRiskSummary,
    RiskOverview,
)
from .....engine import utilisation_status
from .....interfaces import RiskRepository
from .....utils import match_worst_case, to_exposure_book
from .get_overview_query import GetOverviewQuery


class GetOverviewHandler(QueryHandler[GetOverviewQuery, RiskOverview]):
    """Aggregates every pending bet on the platform."""

    message_type = RiskQuery.GET_OVERVIEW

    def __init__(
        self, repository: RiskRepository, clock: Callable[[], datetime]
    ) -> None:
        """Bind the handler to its collaborators."""
        self._repository = repository
        self._clock = clock

    async def execute(self, message: GetOverviewQuery) -> RiskOverview:
        """Return the overview as of now."""
        now = self._clock()
        limits = (await self._repository.load_limits()).limits
        rows = await self._repository.load_book(None)
        totals = await self._repository.load_book_totals()
        type_stakes = await self._repository.load_market_type_stakes()
        tally = await self._repository.count_decisions(
            now - timedelta(hours=DECISION_WINDOW_HOURS)
        )

        book = to_exposure_book(rows)
        match_stakes = {row.match_id: row.stake for row in rows.matches}
        worst_cases = {
            match_id: match_worst_case(match_id, book) for match_id in match_stakes
        }
        matches = (
            await self._repository.load_matches(sorted(match_stakes))
            if match_stakes
            else []
        )

        type_exposure: dict[str, int] = {}
        for market in rows.markets:
            type_exposure[market.market_type] = type_exposure.get(
                market.market_type, 0
            ) + max(0, book.markets[market.market_id].worst_case())

        exposure = sum(worst_cases.values())
        # No platform-wide limit exists in ``risk_limits``: the book's capacity is
        # the per-match limit times the matches carrying pending bets (minimum one).
        exposure_limit = limits.max_liability_per_match * max(1, len(match_stakes))

        return RiskOverview(
            total_stake=totals.stake,
            potential_payout=totals.payout,
            exposure=exposure,
            exposure_limit=exposure_limit,
            state=utilisation_status([(exposure, exposure_limit)]),
            decisions=DecisionCounts(
                accepted=tally.accepted,
                limited=tally.limited,
                rejected=tally.rejected,
            ),
            by_market=sorted(
                (
                    MarketTypeExposure(
                        market_type=row.market_type,
                        market_label=row.market_label,
                        stake=row.stake,
                        exposure=type_exposure.get(row.market_type, 0),
                    )
                    for row in type_stakes
                ),
                key=lambda entry: entry.exposure,
                reverse=True,
            ),
            by_match=sorted(
                (
                    MatchRiskSummary(
                        match_id=UUID(match.match_id),
                        match_label=match.match_label,
                        league_name=match.league_name,
                        kickoff_at=match.kickoff_at,
                        stake=match_stakes[match.match_id],
                        exposure=worst_cases[match.match_id],
                        state=utilisation_status(
                            [
                                (
                                    worst_cases[match.match_id],
                                    limits.max_liability_per_match,
                                )
                            ]
                        ),
                    )
                    for match in matches
                ),
                key=lambda entry: entry.exposure,
                reverse=True,
            ),
            generated_at=now,
        )
