from __future__ import annotations

import logging

from betng_service_kit import Container

from ..constants import LOGGER_TOKEN, RISK_ANALYSER_TOKEN
from ..interfaces import RiskAnalyser


def load_container(analyser: RiskAnalyser, logger: logging.Logger) -> Container:
    container = Container()

    container.register_value(RISK_ANALYSER_TOKEN, analyser)
    container.register_value(LOGGER_TOKEN, logger)

    return container
