from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import AnalyticsQueryType
from .....dtos import SessionAnalysisList
from .....types import BetScope, SessionKind


@dataclass(frozen=True)
class ListSessionsQuery(Query[SessionAnalysisList]):
    """Asks for the global bets cut into analysis periods.

    A session is a period over the same global bets. It is not a game
    session, and no match, market or price belongs to one.
    """

    kind: SessionKind
    scope: BetScope
    limit: int

    type: str = AnalyticsQueryType.LIST_SESSIONS
