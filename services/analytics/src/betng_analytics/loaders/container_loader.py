from __future__ import annotations

import logging

from betng_service_kit import Container

from ..constants import ANALYTICS_READER_TOKEN, LOGGER_TOKEN
from ..interfaces import AnalyticsReader


def load_container(reader: AnalyticsReader, logger: logging.Logger) -> Container:
    container = Container()

    container.register_value(ANALYTICS_READER_TOKEN, reader)
    container.register_value(LOGGER_TOKEN, logger)

    return container
