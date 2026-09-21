from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Command

from .....constants import SimulationCommand
from .....dtos import RunMatchRequest, RunMatchResponse


@dataclass(frozen=True)
class RunMatchCommand(Command[RunMatchResponse]):
    request: RunMatchRequest

    type: str = SimulationCommand.RUN_MATCH
