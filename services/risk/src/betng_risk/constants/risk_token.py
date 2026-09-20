from __future__ import annotations

import logging

from betng_service_kit import Token

from ..interfaces import RiskAnalyser

RISK_ANALYSER_TOKEN: Token[RiskAnalyser] = Token("risk.analyser")

LOGGER_TOKEN: Token[logging.Logger] = Token("risk.logger")
