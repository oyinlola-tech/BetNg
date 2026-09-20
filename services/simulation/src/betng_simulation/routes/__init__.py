"""The simulation service's HTTP route table."""

from .simulation_route import API_PREFIX, create_simulation_router

__all__ = ["API_PREFIX", "create_simulation_router"]
