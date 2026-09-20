from __future__ import annotations

from typing import Final


class OddsCommand:
    GENERATE_ODDS: Final = "odds.generateOdds"


class OddsQuery:
    GET_MATCH_ODDS: Final = "odds.getMatchOdds"


class OddsProcedure:
    CALCULATE_ODDS: Final = "odds.calculateOdds"
    GET_MATCH_ODDS: Final = "odds.getMatchOdds"
