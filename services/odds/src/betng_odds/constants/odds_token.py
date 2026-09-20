from __future__ import annotations

import logging

from betng_service_kit import Token

from ..interfaces import OddsPricer

ODDS_PRICER_TOKEN: Token[OddsPricer] = Token("odds.pricer")

LOGGER_TOKEN: Token[logging.Logger] = Token("odds.logger")
