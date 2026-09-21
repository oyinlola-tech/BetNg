"""Container tokens."""

from __future__ import annotations

import logging

from betng_service_kit import Token

from ..interfaces import (
    AuditRecorder,
    EventPublisher,
    ExposureReader,
    MatchDirectory,
    OddsRepository,
    ProbabilityModel,
)

ODDS_REPOSITORY_TOKEN: Token[OddsRepository] = Token("odds.repository")
PROBABILITY_MODEL_TOKEN: Token[ProbabilityModel] = Token("odds.probabilityModel")
EVENT_PUBLISHER_TOKEN: Token[EventPublisher] = Token("odds.eventPublisher")
AUDIT_RECORDER_TOKEN: Token[AuditRecorder] = Token("odds.auditRecorder")
MATCH_DIRECTORY_TOKEN: Token[MatchDirectory] = Token("odds.matchDirectory")
EXPOSURE_READER_TOKEN: Token[ExposureReader] = Token("odds.exposureReader")

LOGGER_TOKEN: Token[logging.Logger] = Token("odds.logger")
