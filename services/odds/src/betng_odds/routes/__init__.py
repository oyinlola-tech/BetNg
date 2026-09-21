"""REST routes."""

from .odds_route import API_PREFIX, INTERNAL_PREFIX, create_odds_router

__all__ = ["API_PREFIX", "INTERNAL_PREFIX", "create_odds_router"]
