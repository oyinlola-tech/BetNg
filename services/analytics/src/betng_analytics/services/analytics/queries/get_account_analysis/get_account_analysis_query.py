from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import AnalyticsQueryType
from .....dtos import AccountAnalysis
from .....types import SubjectKind, Window


@dataclass(frozen=True)
class GetAccountAnalysisQuery(Query[AccountAnalysis]):
    kind: SubjectKind
    subject_id: str
    window: Window

    type: str = AnalyticsQueryType.GET_ACCOUNT_ANALYSIS
