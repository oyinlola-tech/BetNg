"""Simulation HTTP handlers.

A controller is the translation layer and nothing else: FastAPI has already
validated the body against the contract shape, so the controller dispatches
one message on a bus and returns the result. No engine logic lives here.
"""

from __future__ import annotations

from betng_service_kit import CommandBus, QueryBus

from ..dtos import (
    OutcomeProbabilities,
    ProbabilityRequest,
    SimulationRequest,
    SimulationResult,
)
from ..services.simulation.commands import RunSimulationCommand
from ..services.simulation.queries import GetProbabilitiesQuery


class SimulationController:
    """The handlers the simulation routes bind to."""

    def __init__(self, command_bus: CommandBus, query_bus: QueryBus) -> None:
        self._command_bus = command_bus
        self._query_bus = query_bus

    async def run_simulation(
        self, request: SimulationRequest
    ) -> SimulationResult:
        """Play one virtual match.

        Args:
            request: The fixture and the two teams.

        Returns:
            The result and the timeline behind it.
        """
        return await self._command_bus.execute(RunSimulationCommand(request))

    async def get_probabilities(
        self, request: ProbabilityRequest
    ) -> OutcomeProbabilities:
        """Compute the outcome probabilities for a pairing.

        Args:
            request: The fixture and the two teams.

        Returns:
            The home, draw and away probabilities.
        """
        return await self._query_bus.execute(GetProbabilitiesQuery(request))
