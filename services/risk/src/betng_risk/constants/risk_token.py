"""The risk service's dependency-injection tokens."""

from __future__ import annotations

import logging

from betng_service_kit import Token

from ..interfaces import RiskAnalyser

#: Resolves the analyser that turns stakes into an exposure report.
RISK_ANALYSER_TOKEN: Token[RiskAnalyser] = Token("risk.analyser")

#: Resolves the root logger.
LOGGER_TOKEN: Token[logging.Logger] = Token("risk.logger")
