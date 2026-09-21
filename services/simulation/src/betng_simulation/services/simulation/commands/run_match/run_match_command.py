"""Run match command."""

from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Command

from .....constants import SimulationCommand
from .....dtos import RunMatchRequest, RunMatchResponse


@dataclass(frozen=True)
class RunMatchCommand(Command[RunMatchResponse]):
    """Asks for one match to be played, once.

    It carries the match id and the two teams, and nothing else. There is no
    field through which the book's position could reach the engine.
    """

    request: RunMatchRequest

    type: str = SimulationCommand.RUN_MATCH
