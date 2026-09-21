from __future__ import annotations

import logging

from betng_service_kit import Token

from ..interfaces import AnalyticsReader

ANALYTICS_READER_TOKEN: Token[AnalyticsReader] = Token("analytics.reader")

LOGGER_TOKEN: Token[logging.Logger] = Token("analytics.logger")
