"""Risk HTTP handlers.

REST is the risk service's *secondary* API, and it is for development and
manual inspection only. The gateway forwards nothing to this service: risk is
internal, and a public client must never be able to read the book's exposure.
See `docs/api/rpc.md` and the security boundary in `docs/architecture.md`.
"""

from __future__ import annotations

from betng_service_kit import QueryBus

from ..dtos import ExposureReport, ExposureRequest
from ..services.risk.queries import EvaluateExposureQuery


class RiskController:
    def __init__(self, query_bus: QueryBus) -> None:
        self._query_bus = query_bus

    async def evaluate_exposure(
        self, request: ExposureRequest
    ) -> ExposureReport:
        return await self._query_bus.execute(EvaluateExposureQuery(request))
