"""The odds service's HTTP route table."""

from .odds_route import API_PREFIX, create_odds_router

__all__ = ["API_PREFIX", "create_odds_router"]
