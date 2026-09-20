"""The odds service's dependency-injection tokens."""

from __future__ import annotations

import logging

from betng_service_kit import Token

from ..interfaces import OddsPricer

#: Resolves the pricer that turns probabilities into odds.
ODDS_PRICER_TOKEN: Token[OddsPricer] = Token("odds.pricer")

#: Resolves the root logger.
LOGGER_TOKEN: Token[logging.Logger] = Token("odds.logger")
