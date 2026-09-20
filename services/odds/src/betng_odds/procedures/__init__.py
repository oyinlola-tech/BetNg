"""The odds service's RPC surface.

RPC is this service's primary API; the REST routes exist for debugging and
analytics. Both dispatch onto the same buses.
"""

from .odds_procedure import create_odds_rpc_server

__all__ = ["create_odds_rpc_server"]
