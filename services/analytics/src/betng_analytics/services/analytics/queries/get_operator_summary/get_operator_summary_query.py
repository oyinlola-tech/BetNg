from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import AnalyticsQueryType
from .....dtos import OperatorReconciliation
from .....types import BetScope


@dataclass(frozen=True)
class GetOperatorSummaryQuery(Query[OperatorReconciliation]):
    scope: BetScope

    type: str = AnalyticsQueryType.GET_OPERATOR_SUMMARY
