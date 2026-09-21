"""Handlers for the gateway-proxied admin routes.

The routes authorise the actor before a handler runs. Nothing here can set a
score, pick a winner or re-run a match that has a result.
"""

from __future__ import annotations

from uuid import UUID

from betng_service_kit import Actor, CommandBus, QueryBus

from ..dtos import (
    AdminRunStatus,
    AdminSimulationRun,
    AdminSimulationRunList,
    ModelConfigurationUpdate,
    ModelConfigurationView,
    SimulationActionRequest,
)
from ..services.simulation.commands import (
    ApplyRunActionCommand,
    UpdateConfigurationCommand,
)
from ..services.simulation.queries import GetConfigurationQuery, ListAdminRunsQuery


class AdminSimulationController:
    """Admin route handlers; the routes authorise the actor first."""

    def __init__(self, command_bus: CommandBus, query_bus: QueryBus) -> None:
        """Store the collaborators."""
        self._command_bus = command_bus
        self._query_bus = query_bus

    async def list_runs(
        self, status: AdminRunStatus | None, limit: int
    ) -> AdminSimulationRunList:
        """List runs."""
        return await self._query_bus.execute(ListAdminRunsQuery(status, limit))

    async def apply_action(
        self, actor: Actor, run_id: UUID, body: SimulationActionRequest
    ) -> AdminSimulationRun:
        """Apply RETRY or CANCEL to a run."""
        return await self._command_bus.execute(
            ApplyRunActionCommand(str(run_id), body, actor)
        )

    async def get_configuration(self) -> ModelConfigurationView:
        """Return the active configuration."""
        return await self._query_bus.execute(GetConfigurationQuery())

    async def update_configuration(
        self, actor: Actor, body: ModelConfigurationUpdate
    ) -> ModelConfigurationView:
        """Store and activate a new configuration version."""
        return await self._command_bus.execute(UpdateConfigurationCommand(body, actor))
