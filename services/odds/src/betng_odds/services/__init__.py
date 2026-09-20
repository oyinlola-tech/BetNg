"""The application services, each registering its own CQRS handlers."""

from .odds import register_odds_service

__all__ = ["register_odds_service"]
