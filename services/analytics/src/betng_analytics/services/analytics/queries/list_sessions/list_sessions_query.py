from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import AnalyticsQueryType
from .....dtos import SessionAnalysisList
from .....types import BetScope, SessionKind


@dataclass(frozen=True)
class ListSessionsQuery(Query[SessionAnalysisList]):
    kind: SessionKind
    scope: BetScope
    limit: int

    type: str = AnalyticsQueryType.LIST_SESSIONS
