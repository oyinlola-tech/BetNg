"""Simulation service routes.

Everything the platform exposes publicly sits behind ``/api/v1``. The shared
kit registers ``/health`` and ``/ready``, which deliberately sit outside it
because they describe the process, not the domain.

Both endpoints are POST because both take a body describing the pairing; the
probabilities endpoint is nonetheless a read, and is dispatched on the query
bus, because it changes nothing.
"""

from __future__ import annotations

from fastapi import APIRouter

from ..controllers import SimulationController
from ..dtos import (
    OutcomeProbabilities,
    ProbabilityRequest,
    SimulationRequest,
    SimulationResult,
)

API_PREFIX = "/api/v1"


def create_simulation_router(controller: SimulationController) -> APIRouter:
    router = APIRouter(prefix=API_PREFIX, tags=["simulation"])

    @router.post(
        "/simulations",
        response_model=SimulationResult,
        summary="Play one virtual match",
        description=(
            "Runs the simulation for a fixture and returns the result and "
            "timeline. Called only after betting has closed. The request "
            "carries no bet data, by design."
        ),
    )
    async def run_simulation(request: SimulationRequest) -> SimulationResult:
        return await controller.run_simulation(request)

    @router.post(
        "/probabilities",
        response_model=OutcomeProbabilities,
        summary="Compute outcome probabilities",
        description=(
            "Returns the home, draw and away probabilities for a pairing. "
            "The odds service prices from these; it does not compute them."
        ),
    )
    async def get_probabilities(
        request: ProbabilityRequest,
    ) -> OutcomeProbabilities:
        return await controller.get_probabilities(request)

    return router
