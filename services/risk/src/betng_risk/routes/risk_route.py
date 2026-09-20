"""Risk service routes.

Development and manual inspection only. The gateway forwards nothing here.
"""

from __future__ import annotations

from fastapi import APIRouter

from ..controllers import RiskController
from ..dtos import ExposureReport, ExposureRequest

API_PREFIX = "/api/v1"


def create_risk_router(controller: RiskController) -> APIRouter:
    """Bind the risk endpoints to a router.

    Args:
        controller: The handlers to bind.

    Returns:
        A router to include on the application.
    """
    router = APIRouter(prefix=API_PREFIX, tags=["risk"])

    @router.post(
        "/exposure",
        response_model=ExposureReport,
        summary="Assess a market's exposure",
        description=(
            "Returns a market's worst-case liability and the action to take. "
            "Internal: the gateway forwards nothing to this service. The "
            "betting service calls `risk.calculateExposure` over RPC."
        ),
    )
    async def evaluate_exposure(request: ExposureRequest) -> ExposureReport:
        return await controller.evaluate_exposure(request)

    return router
