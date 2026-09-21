from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import AnalyticsQueryType
from .....dtos import MatchAnalysis


@dataclass(frozen=True)
class GetMatchAnalysisQuery(Query[MatchAnalysis]):
    """Asks how the global bets fell on one match.

    It reads bets about a match; nothing it answers feeds the match.
    """

    match_id: str

    type: str = AnalyticsQueryType.GET_MATCH_ANALYSIS
