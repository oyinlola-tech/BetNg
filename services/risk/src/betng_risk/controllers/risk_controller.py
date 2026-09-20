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
    """The handlers the risk routes bind to."""

    def __init__(self, query_bus: QueryBus) -> None:
        """Dispatch through the given query bus."""
        self._query_bus = query_bus

    async def evaluate_exposure(
        self, request: ExposureRequest
    ) -> ExposureReport:
        """Assess a market's exposure.

        Args:
            request: The market and its accepted stakes per selection.

        Returns:
            The worst-case liability and the action to take.
        """
        return await self._query_bus.execute(EvaluateExposureQuery(request))
