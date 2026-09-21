from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import AnalyticsQueryType
from .....dtos import AccountAnalysis
from .....types import SubjectKind, Window


@dataclass(frozen=True)
class GetAccountAnalysisQuery(Query[AccountAnalysis]):
    """Asks for one customer's, shop's or cashier's share of the global bets.

    A view over the same bets every other figure counts: the subjects'
    shares add up to the global totals, and none of them implies a
    separate game.
    """

    kind: SubjectKind
    subject_id: str
    window: Window

    type: str = AnalyticsQueryType.GET_ACCOUNT_ANALYSIS
