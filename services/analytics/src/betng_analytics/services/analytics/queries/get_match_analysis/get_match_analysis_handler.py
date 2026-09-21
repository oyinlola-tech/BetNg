from __future__ import annotations

from betng_service_kit import QueryHandler

from .....constants import AnalyticsQueryType
from .....dtos import MatchAnalysis, MatchResult
from .....errors import SubjectNotFoundError
from .....interfaces import AnalyticsReader
from .....types import Row, Window
from .....utils import now, to_iso
from ...mappers import to_breakdown_row, to_overview
from .get_match_analysis_query import GetMatchAnalysisQuery

COMPLETED = "COMPLETED"


def _result(match: Row) -> MatchResult | None:
    """Answer the result only for a match that is ``COMPLETED``.

    The reader already withholds the result row until then; checking the
    status again keeps the secrecy rule in force if the statement changes.
    """
    if match["status"] != COMPLETED or match["home_goals"] is None:
        return None

    return MatchResult(
        home_goals=match["home_goals"],
        away_goals=match["away_goals"],
        winner=match["winner"],
        winning_gap=match["winning_gap"],
    )


class GetMatchAnalysisHandler(QueryHandler[GetMatchAnalysisQuery, MatchAnalysis]):
    message_type = AnalyticsQueryType.GET_MATCH_ANALYSIS

    def __init__(self, reader: AnalyticsReader) -> None:
        self._reader = reader

    async def execute(self, message: GetMatchAnalysisQuery) -> MatchAnalysis:
        rows = await self._reader.match_analysis(message.match_id)

        if rows is None:
            raise SubjectNotFoundError("match", message.match_id)

        match = rows.match

        return MatchAnalysis(
            match_id=str(match["id"]),
            label=f"{match['home_name']} vs {match['away_name']}",
            league_id=str(match["league_id"]),
            league_name=match["league_name"],
            season=match["season"],
            matchday=match["matchday"],
            kickoff_at=to_iso(match["kickoff_at"]),
            status=match["status"],
            overview=to_overview(rows.overview, Window(), now()),
            by_market=[to_breakdown_row(row) for row in rows.by_market],
            by_selection=[to_breakdown_row(row) for row in rows.by_selection],
            result=_result(match),
        )
