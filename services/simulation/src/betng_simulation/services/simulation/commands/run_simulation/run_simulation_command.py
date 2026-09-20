from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Command

from .....constants import SimulationCommand
from .....dtos import SimulationRequest


@dataclass(frozen=True)
class RunSimulationCommand(Command):
    """Asks for one virtual match to be played.

    It carries the fixture and the two teams, and nothing else. There is no
    field through which the book's position could reach the engine.
    """

    request: SimulationRequest

    type: str = SimulationCommand.RUN_SIMULATION
