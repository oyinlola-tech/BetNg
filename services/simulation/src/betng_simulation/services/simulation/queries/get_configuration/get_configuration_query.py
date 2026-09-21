"""Get configuration query."""

from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import SimulationQuery
from .....dtos import ModelConfigurationView


@dataclass(frozen=True)
class GetConfigurationQuery(Query[ModelConfigurationView]):
    """Asks for the active configuration."""

    type: str = SimulationQuery.GET_CONFIGURATION
