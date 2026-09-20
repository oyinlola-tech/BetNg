"""The odds service's CQRS and RPC discriminators."""

from __future__ import annotations

from typing import Final


class OddsCommand:
    """Command types the odds service handles."""

    GENERATE_ODDS: Final = "odds.generateOdds"


class OddsQuery:
    """Query types the odds service handles."""

    GET_MATCH_ODDS: Final = "odds.getMatchOdds"


class OddsProcedure:
    """RPC procedure names the odds service answers."""

    CALCULATE_ODDS: Final = "odds.calculateOdds"
    GET_MATCH_ODDS: Final = "odds.getMatchOdds"
