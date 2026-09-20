"""The simulation service's RPC surface.

RPC is this service's primary API; the REST routes in ``routes`` exist for
debugging and manual inspection. Both dispatch onto the same buses.
"""

from .simulation_procedure import (
    SimulationProcedure,
    create_simulation_rpc_server,
)

__all__ = ["SimulationProcedure", "create_simulation_rpc_server"]
