"""Apply run action command."""

from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Actor, Command

from .....constants import SimulationCommand
from .....dtos import AdminSimulationRun, SimulationActionRequest


@dataclass(frozen=True)
class ApplyRunActionCommand(Command[AdminSimulationRun]):
    """An operator's ``RETRY`` or ``CANCEL`` of a failed run."""

    run_id: str
    request: SimulationActionRequest
    actor: Actor

    type: str = SimulationCommand.APPLY_RUN_ACTION
