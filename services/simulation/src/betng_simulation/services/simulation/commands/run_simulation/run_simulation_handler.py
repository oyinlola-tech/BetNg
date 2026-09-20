"""The handler behind ``POST /api/v1/simulations``."""

from __future__ import annotations

from betng_service_kit import CommandHandler

from .....constants import SimulationCommand
from .....dtos import SimulationResult
from .....interfaces import SimulationEngine
from .run_simulation_command import RunSimulationCommand


class RunSimulationHandler(CommandHandler[RunSimulationCommand, SimulationResult]):
    """Plays one virtual match through the engine.

    The handler exists and is wired; the engine behind it is not built yet and
    raises a 501. See `repositories/simulation_repository.py`.
    """

    message_type = SimulationCommand.RUN_SIMULATION

    def __init__(self, engine: SimulationEngine) -> None:
        self._engine = engine

    async def execute(self, message: RunSimulationCommand) -> SimulationResult:
        return await self._engine.simulate(message.request)
