"""The application services, each registering its own CQRS handlers."""

from .risk import register_risk_service

__all__ = ["register_risk_service"]
