from __future__ import annotations

import logging

from betng_service_kit import Token

from ..interfaces import AnalyticsReader, ExportReader

ANALYTICS_READER_TOKEN: Token[AnalyticsReader] = Token("analytics.reader")

EXPORT_READER_TOKEN: Token[ExportReader] = Token("analytics.exportReader")

REPORT_TIMEZONE_TOKEN: Token[str] = Token("analytics.reportTimezone")

LOGGER_TOKEN: Token[logging.Logger] = Token("analytics.logger")
