"""Simulation commands and queries."""

from __future__ import annotations

from betng_service_kit import CommandBus, Container, QueryBus

from ...constants import (
    AUDIT_RECORDER_TOKEN,
    BACKGROUND_AUDITOR_TOKEN,
    LOGGER_TOKEN,
    MATCH_READ_MODEL_TOKEN,
    SIMULATE_TOKEN,
    SIMULATION_REPOSITORY_TOKEN,
)
from .commands import (
    ApplyRunActionHandler,
    RunMatchHandler,
    UpdateConfigurationHandler,
)
from .queries import (
    CalculateProbabilitiesHandler,
    GetConfigurationHandler,
    GetMatchRunHandler,
    ListAdminRunsHandler,
    ListMatchEventsHandler,
)


def register_simulation_service(
    container: Container, command_bus: CommandBus, query_bus: QueryBus
) -> None:
    """Register the command and query handlers."""
    repository = container.resolve(SIMULATION_REPOSITORY_TOKEN)
    match_read_model = container.resolve(MATCH_READ_MODEL_TOKEN)
    auditor = container.resolve(BACKGROUND_AUDITOR_TOKEN)
    logger = container.resolve(LOGGER_TOKEN)

    command_bus.register(
        RunMatchHandler(repository, container.resolve(SIMULATE_TOKEN), auditor, logger)
    )
    command_bus.register(
        ApplyRunActionHandler(repository, match_read_model, auditor, logger)
    )
    command_bus.register(
        UpdateConfigurationHandler(
            repository, container.resolve(AUDIT_RECORDER_TOKEN), logger
        )
    )

    query_bus.register(CalculateProbabilitiesHandler(repository))
    query_bus.register(GetMatchRunHandler(repository))
    query_bus.register(ListMatchEventsHandler(repository))
    query_bus.register(ListAdminRunsHandler(repository, match_read_model))
    query_bus.register(GetConfigurationHandler(repository))
