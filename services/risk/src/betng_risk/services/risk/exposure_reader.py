from __future__ import annotations

from collections.abc import Sequence

from ...dtos import MatchExposure
from ...engine import Limits
from ...interfaces import RiskRepository
from ...types import MatchRow
from ...utils import build_match_exposure, frozen_match_exposure


class ExposureReader:
    """Builds ``MatchExposure`` for a set of matches."""

    def __init__(self, repository: RiskRepository) -> None:
        self._repository = repository

    async def live(
        self, matches: Sequence[MatchRow], limits: Limits
    ) -> list[MatchExposure]:
        """Compute exposure from the pending book, ignoring any freeze."""
        if not matches:
            return []

        rows = await self._repository.load_book([match.match_id for match in matches])
        market_ids = [market.market_id for market in rows.markets]
        markets = await self._repository.load_markets(market_ids) if market_ids else []
        selections = (
            await self._repository.load_selections(market_ids) if market_ids else []
        )

        return [
            build_match_exposure(match, markets, selections, rows, limits)
            for match in matches
        ]

    async def current(
        self, matches: Sequence[MatchRow], limits: Limits
    ) -> list[MatchExposure]:
        frozen_ids = [
            match.match_id for match in matches if match.frozen_at is not None
        ]
        snapshots = (
            await self._repository.load_snapshots(frozen_ids) if frozen_ids else {}
        )
        live = {
            str(exposure.match_id): exposure
            for exposure in await self.live(
                [match for match in matches if match.match_id not in snapshots],
                limits,
            )
        }

        return [
            frozen_match_exposure(match, snapshots[match.match_id])
            if match.match_id in snapshots
            else live[match.match_id]
            for match in matches
        ]
