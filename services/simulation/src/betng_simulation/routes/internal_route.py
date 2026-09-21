"""Internal routes: never proxied, so they may return unrevealed results."""

from __future__ import annotations

from uuid import UUID

from betng_service_kit import require_internal
from fastapi import APIRouter, Depends

from ..controllers import SimulationController
from ..dtos import MatchEventList, MatchRunDetail, RunMatchBody, RunMatchResponse
from ..middlewares import bind_request_context

INTERNAL_PREFIX = "/internal/simulation"


def create_internal_router(controller: SimulationController) -> APIRouter:
    """Build the internal router, guarded by the internal token."""
    router = APIRouter(
        prefix=INTERNAL_PREFIX,
        tags=["simulation-internal"],
        dependencies=[Depends(require_internal), Depends(bind_request_context)],
    )

    @router.post(
        "/matches/{match_id}/run",
        response_model=RunMatchResponse,
        summary="Play one match, once",
        description=(
            "Runs the simulation for a match and stores the result and "
            "timeline. A second call returns the stored run with "
            "`duplicate: true`. The body carries the two teams and no bet data."
        ),
    )
    async def run_match(match_id: UUID, body: RunMatchBody) -> RunMatchResponse:
        return await controller.run_match(match_id, body)

    @router.get("/matches/{match_id}", response_model=MatchRunDetail)
    async def get_match_run(match_id: UUID) -> MatchRunDetail:
        return await controller.get_match_run(match_id)

    @router.get(
        "/matches/{match_id}/events",
        response_model=MatchEventList,
        response_model_exclude_none=True,
    )
    async def list_match_events(match_id: UUID) -> MatchEventList:
        return await controller.list_match_events(match_id)

    return router
