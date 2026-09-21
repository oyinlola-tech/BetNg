"""Admin routes at the gateway's path; none sets a score or re-runs a result."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from betng_service_kit import Actor
from fastapi import APIRouter, Depends, Query

from ..constants import (
    ADMIN_RUNS_DEFAULT_LIMIT,
    ADMIN_RUNS_MAX_LIMIT,
    SimulationPermission,
)
from ..controllers import AdminSimulationController
from ..dtos import (
    AdminRunStatus,
    AdminSimulationRun,
    AdminSimulationRunList,
    ModelConfigurationUpdate,
    ModelConfigurationView,
    SimulationActionRequest,
)
from ..middlewares import bind_request_context
from ..validators import require_admin

ADMIN_PREFIX = "/api/v1/admin"

Reader = Annotated[Actor, Depends(require_admin(SimulationPermission.READ))]
Operator = Annotated[Actor, Depends(require_admin(SimulationPermission.OPERATE))]


def create_admin_router(controller: AdminSimulationController) -> APIRouter:
    """Build the admin router; every route requires an admin permission."""
    router = APIRouter(
        prefix=ADMIN_PREFIX,
        tags=["simulation-admin"],
        dependencies=[Depends(bind_request_context)],
    )

    @router.get("/simulations", response_model=AdminSimulationRunList)
    async def list_runs(
        _actor: Reader,
        status: AdminRunStatus | None = None,
        limit: Annotated[
            int, Query(ge=1, le=ADMIN_RUNS_MAX_LIMIT)
        ] = ADMIN_RUNS_DEFAULT_LIMIT,
    ) -> AdminSimulationRunList:
        return await controller.list_runs(status, limit)

    @router.post("/simulations/{run_id}/actions", response_model=AdminSimulationRun)
    async def apply_action(
        actor: Operator, run_id: UUID, body: SimulationActionRequest
    ) -> AdminSimulationRun:
        return await controller.apply_action(actor, run_id, body)

    @router.get("/simulation/config", response_model=ModelConfigurationView)
    async def get_configuration(_actor: Reader) -> ModelConfigurationView:
        return await controller.get_configuration()

    @router.put("/simulation/config", response_model=ModelConfigurationView)
    async def update_configuration(
        actor: Operator, body: ModelConfigurationUpdate
    ) -> ModelConfigurationView:
        return await controller.update_configuration(actor, body)

    return router
