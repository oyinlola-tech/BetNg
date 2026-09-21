from __future__ import annotations

import logging

from betng_service_kit import Container

from ..constants import (
    AUDIT_RECORDER_TOKEN,
    BACKGROUND_AUDITOR_TOKEN,
    LOGGER_TOKEN,
    MATCH_READ_MODEL_TOKEN,
    SEED_SECRET_TOKEN,
    SIMULATE_TOKEN,
    SIMULATION_REPOSITORY_TOKEN,
)
from ..interfaces import AuditRecorder, MatchReadModel, Simulate
from ..repositories import SimulationRepository
from ..utils import BackgroundAuditor


def load_container(
    repository: SimulationRepository,
    match_read_model: MatchReadModel,
    audit_recorder: AuditRecorder,
    simulate: Simulate,
    seed_secret: str | None,
    logger: logging.Logger,
) -> Container:
    container = Container()

    container.register_value(SIMULATION_REPOSITORY_TOKEN, repository)
    container.register_value(MATCH_READ_MODEL_TOKEN, match_read_model)
    container.register_value(AUDIT_RECORDER_TOKEN, audit_recorder)
    container.register_value(
        BACKGROUND_AUDITOR_TOKEN, BackgroundAuditor(audit_recorder, logger)
    )
    container.register_value(SIMULATE_TOKEN, simulate)
    container.register_value(SEED_SECRET_TOKEN, seed_secret)
    container.register_value(LOGGER_TOKEN, logger)

    return container
