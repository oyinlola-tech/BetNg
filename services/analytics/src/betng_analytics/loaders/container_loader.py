from __future__ import annotations

import logging

from betng_service_kit import Container

from ..constants import (
    ANALYTICS_READER_TOKEN,
    EXPORT_READER_TOKEN,
    LOGGER_TOKEN,
    REPORT_TIMEZONE_TOKEN,
)
from ..interfaces import AnalyticsReader, ExportReader


def load_container(
    reader: AnalyticsReader,
    exports: ExportReader,
    report_timezone: str,
    logger: logging.Logger,
) -> Container:
    container = Container()

    container.register_value(ANALYTICS_READER_TOKEN, reader)
    container.register_value(EXPORT_READER_TOKEN, exports)
    container.register_value(REPORT_TIMEZONE_TOKEN, report_timezone)
    container.register_value(LOGGER_TOKEN, logger)

    return container
