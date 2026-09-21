from __future__ import annotations

from collections import defaultdict

from betng_service_kit import QueryHandler

from .....constants import AnalyticsQueryType
from .....dtos import (
    ExposureFigures,
    ExposureReport,
    MarketExposure,
    MatchExposure,
    SelectionExposure,
)
from .....interfaces import AnalyticsReader
from .....types import Row
from .....utils import now, to_iso
from .get_exposure_query import GetExposureQuery


def _figures(row: Row) -> dict[str, int]:
    return {
        "bets": row["bets"],
        "stake": row["stake"],
        "potential_payout": row["potential_payout"],
        "liability": row["liability"],
    }


class GetExposureHandler(QueryHandler[GetExposureQuery, ExposureReport]):
    message_type = AnalyticsQueryType.GET_EXPOSURE

    def __init__(self, reader: AnalyticsReader) -> None:
        self._reader = reader

    async def execute(self, message: GetExposureQuery) -> ExposureReport:
        rows = await self._reader.exposure(message.scope, message.limit)

        selections: defaultdict[str, list[SelectionExposure]] = defaultdict(list)

        for row in rows.selections:
            selections[str(row["market_id"])].append(
                SelectionExposure(
                    selection_id=str(row["selection_id"]),
                    selection_code=row["selection_code"],
                    selection_label=row["selection_label"],
                    **_figures(row),
                )
            )

        markets: defaultdict[str, list[MarketExposure]] = defaultdict(list)

        for row in rows.markets:
            markets[str(row["match_id"])].append(
                MarketExposure(
                    market_id=str(row["market_id"]),
                    market_type=row["market_type"],
                    market_label=row["market_label"],
                    line=None if row["line"] is None else float(row["line"]),
                    selections=selections[str(row["market_id"])],
                    **_figures(row),
                )
            )

        return ExposureReport(
            totals=ExposureFigures(**_figures(rows.totals)),
            items=[
                MatchExposure(
                    match_id=str(row["match_id"]),
                    match_label=row["match_label"],
                    league_id=row["league_id"],
                    league_name=row["league_name"],
                    kickoff_at=to_iso(row["kickoff_at"]),
                    markets=markets[str(row["match_id"])],
                    **_figures(row),
                )
                for row in rows.matches
            ],
            generated_at=to_iso(now()),
        )
