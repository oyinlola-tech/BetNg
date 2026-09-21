"""Update configuration command."""

from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Actor, Command

from .....constants import SimulationCommand
from .....dtos import ModelConfigurationUpdate, ModelConfigurationView


@dataclass(frozen=True)
class UpdateConfigurationCommand(Command[ModelConfigurationView]):
    """A partial parameter change by an admin."""

    request: ModelConfigurationUpdate
    actor: Actor

    type: str = SimulationCommand.UPDATE_CONFIGURATION
