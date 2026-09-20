"""The risk service's HTTP route table."""

from .risk_route import API_PREFIX, create_risk_router

__all__ = ["API_PREFIX", "create_risk_router"]
