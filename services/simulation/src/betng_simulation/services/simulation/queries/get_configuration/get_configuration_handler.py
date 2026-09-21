"""Get configuration handler."""

from __future__ import annotations

from betng_service_kit import QueryHandler

from .....constants import SimulationQuery
from .....dtos import ModelConfigurationView
from .....repositories import SimulationRepository
from .....utils import parameters_of
from .get_configuration_query import GetConfigurationQuery


class GetConfigurationHandler(
    QueryHandler[GetConfigurationQuery, ModelConfigurationView]
):
    """Reads the active configuration."""

    message_type = SimulationQuery.GET_CONFIGURATION

    def __init__(self, repository: SimulationRepository) -> None:
        """Store the collaborators."""
        self._repository = repository

    async def execute(self, message: GetConfigurationQuery) -> ModelConfigurationView:
        """Execute the message."""
        async with self._repository.transaction() as connection:
            stored = await self._repository.get_active_configuration(connection)

        return ModelConfigurationView(
            version=stored.configuration.version,
            model_version=stored.configuration.model_version,
            active=stored.active,
            params=parameters_of(stored.configuration),
            created_at=stored.created_at,
            created_by=stored.created_by,
            reason=stored.reason,
        )
