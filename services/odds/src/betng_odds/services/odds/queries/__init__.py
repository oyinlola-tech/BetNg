"""The read side of the odds service."""

from .get_match_odds import GetMatchOddsHandler, GetMatchOddsQuery

__all__ = ["GetMatchOddsHandler", "GetMatchOddsQuery"]
