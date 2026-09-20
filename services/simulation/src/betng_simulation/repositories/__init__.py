"""Concrete implementations of the simulation engine contract.

The simulation service is stateless: it holds no database and owns no rows, so
this folder carries the engine rather than a data-access repository. The
naming mirrors the TypeScript services, where the same folder holds whatever
satisfies the service's core interface.
"""

from .simulation_repository import UnbuiltSimulationEngine, create_simulation_engine

__all__ = ["UnbuiltSimulationEngine", "create_simulation_engine"]
