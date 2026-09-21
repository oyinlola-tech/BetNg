from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime

from betng_service_kit import CommandBus, Container, QueryBus

from ...constants import AUDIT_RECORDER_TOKEN, LOGGER_TOKEN, RISK_REPOSITORY_TOKEN
from .commands import EvaluateStakeHandler, FreezeExposureHandler, UpdateLimitsHandler
from .exposure_reader import ExposureReader
from .queries import (
    GetLimitsHandler,
    GetMatchExposureHandler,
    GetOverviewHandler,
    ListExposureHandler,
)


def _utc_now() -> datetime:
    return datetime.now(UTC)


def register_risk_service(
    container: Container,
    command_bus: CommandBus,
    query_bus: QueryBus,
    clock: Callable[[], datetime] = _utc_now,
) -> None:
    repository = container.resolve(RISK_REPOSITORY_TOKEN)
    audit = container.resolve(AUDIT_RECORDER_TOKEN)
    logger = container.resolve(LOGGER_TOKEN)
    reader = ExposureReader(repository)

    command_bus.register(EvaluateStakeHandler(repository, clock, logger))
    command_bus.register(FreezeExposureHandler(repository, reader, logger))
    command_bus.register(UpdateLimitsHandler(repository, audit, logger))

    query_bus.register(GetMatchExposureHandler(repository, reader))
    query_bus.register(ListExposureHandler(repository, reader))
    query_bus.register(GetOverviewHandler(repository, clock))
    query_bus.register(GetLimitsHandler(repository))
