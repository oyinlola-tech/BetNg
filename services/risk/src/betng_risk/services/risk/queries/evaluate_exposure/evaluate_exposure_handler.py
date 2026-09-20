from __future__ import annotations

from betng_service_kit import QueryHandler

from .....constants import RiskQuery
from .....dtos import ExposureReport
from .....interfaces import RiskAnalyser
from .evaluate_exposure_query import EvaluateExposureQuery


class EvaluateExposureHandler(
    QueryHandler[EvaluateExposureQuery, ExposureReport]
):
    message_type = RiskQuery.EVALUATE_EXPOSURE

    def __init__(self, analyser: RiskAnalyser) -> None:
        self._analyser = analyser

    async def execute(self, message: EvaluateExposureQuery) -> ExposureReport:
        return await self._analyser.evaluate(message.request)
