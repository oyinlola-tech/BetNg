from __future__ import annotations

import logging
from dataclasses import dataclass

from betng_service_kit import Container

from ..constants import (
    AUDIT_RECORDER_TOKEN,
    EVENT_PUBLISHER_TOKEN,
    EXPOSURE_READER_TOKEN,
    LOGGER_TOKEN,
    MATCH_DIRECTORY_TOKEN,
    ODDS_REPOSITORY_TOKEN,
    PROBABILITY_MODEL_TOKEN,
)
from ..interfaces import (
    AuditRecorder,
    EventPublisher,
    ExposureReader,
    MatchDirectory,
    OddsRepository,
    ProbabilityModel,
)


@dataclass(frozen=True)
class OddsDependencies:
    repository: OddsRepository
    probability_model: ProbabilityModel
    event_publisher: EventPublisher
    audit_recorder: AuditRecorder
    match_directory: MatchDirectory
    exposure_reader: ExposureReader


def load_container(dependencies: OddsDependencies, logger: logging.Logger) -> Container:
    """Register the service's collaborators against their tokens."""
    container = Container()

    container.register_value(ODDS_REPOSITORY_TOKEN, dependencies.repository)
    container.register_value(PROBABILITY_MODEL_TOKEN, dependencies.probability_model)
    container.register_value(EVENT_PUBLISHER_TOKEN, dependencies.event_publisher)
    container.register_value(AUDIT_RECORDER_TOKEN, dependencies.audit_recorder)
    container.register_value(MATCH_DIRECTORY_TOKEN, dependencies.match_directory)
    container.register_value(EXPOSURE_READER_TOKEN, dependencies.exposure_reader)
    container.register_value(LOGGER_TOKEN, logger)

    return container
