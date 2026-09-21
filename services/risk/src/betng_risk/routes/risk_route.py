from __future__ import annotations

from typing import Annotated
from uuid import UUID

from betng_service_kit import Actor, get_request_id, require_internal
from fastapi import APIRouter, Depends, Request

from ..constants import RiskPermission
from ..controllers import RiskController
from ..dtos import (
    MatchExposure,
    MatchExposureList,
    RiskDecision,
    RiskEvaluateRequest,
    RiskLimits,
    RiskOverview,
    UpdateRiskLimitsRequest,
)
from ..middlewares import require_admin

INTERNAL_PREFIX = "/internal/risk"
ADMIN_PREFIX = "/api/v1/admin/risk"

_read = require_admin(frozenset({RiskPermission.READ}))
_write = require_admin(frozenset({RiskPermission.WRITE}))


def create_internal_router(controller: RiskController) -> APIRouter:
    router = APIRouter(
        prefix=INTERNAL_PREFIX,
        tags=["risk-internal"],
        dependencies=[Depends(require_internal)],
    )

    @router.post(
        "/evaluate",
        response_model=RiskDecision,
        response_model_exclude_none=True,
        summary="Decide a slip's stake",
    )
    async def evaluate(body: RiskEvaluateRequest, request: Request) -> RiskDecision:
        return await controller.evaluate(body, get_request_id(request))

    @router.get(
        "/matches/{match_id}/exposure",
        response_model=MatchExposure,
        response_model_exclude_none=True,
        summary="Read one match's exposure",
    )
    async def match_exposure(match_id: UUID) -> MatchExposure:
        return await controller.match_exposure(match_id)

    return router


def create_admin_router(controller: RiskController) -> APIRouter:
    router = APIRouter(prefix=ADMIN_PREFIX, tags=["risk-admin"])

    @router.get(
        "/overview",
        response_model=RiskOverview,
        response_model_exclude_none=True,
        summary="Platform-wide pending exposure",
    )
    async def overview(_: Annotated[Actor, Depends(_read)]) -> RiskOverview:
        return await controller.overview()

    @router.get(
        "/exposure",
        response_model=MatchExposureList,
        response_model_exclude_none=True,
        summary="Exposure by match",
    )
    async def exposure(_: Annotated[Actor, Depends(_read)]) -> MatchExposureList:
        return await controller.exposure()

    @router.get(
        "/limits",
        response_model=RiskLimits,
        response_model_exclude_none=True,
        summary="The limits in force",
    )
    async def limits(_: Annotated[Actor, Depends(_read)]) -> RiskLimits:
        return await controller.limits()

    @router.put(
        "/limits",
        response_model=RiskLimits,
        response_model_exclude_none=True,
        summary="Put a new limits version in force",
    )
    async def update_limits(
        body: UpdateRiskLimitsRequest,
        request: Request,
        actor: Annotated[Actor, Depends(_write)],
    ) -> RiskLimits:
        return await controller.update_limits(body, actor, get_request_id(request))

    return router
