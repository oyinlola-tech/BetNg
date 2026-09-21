from __future__ import annotations

import logging

from betng_service_kit import Container

from ..constants import AUDIT_RECORDER_TOKEN, LOGGER_TOKEN, RISK_REPOSITORY_TOKEN
from ..interfaces import AuditRecorder, RiskRepository


def load_container(
    repository: RiskRepository, audit: AuditRecorder, logger: logging.Logger
) -> Container:
    container = Container()

    container.register_value(RISK_REPOSITORY_TOKEN, repository)
    container.register_value(AUDIT_RECORDER_TOKEN, audit)
    container.register_value(LOGGER_TOKEN, logger)

    return container
