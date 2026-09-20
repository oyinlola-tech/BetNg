"""Builds the dependency-injection container."""

from __future__ import annotations

import logging

from betng_service_kit import Container

from ..constants import LOGGER_TOKEN, ODDS_PRICER_TOKEN
from ..interfaces import OddsPricer


def load_container(pricer: OddsPricer, logger: logging.Logger) -> Container:
    """Register the odds service's singletons.

    Args:
        pricer: The pricer the handlers run through.
        logger: The root logger.

    Returns:
        The container.
    """
    container = Container()

    container.register_value(ODDS_PRICER_TOKEN, pricer)
    container.register_value(LOGGER_TOKEN, logger)

    return container
