"""The application services, each registering its own CQRS handlers."""

from .simulation import register_simulation_service

__all__ = ["register_simulation_service"]
