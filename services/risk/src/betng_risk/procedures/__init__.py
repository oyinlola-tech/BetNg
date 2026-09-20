"""The risk service's RPC surface.

RPC is this service's primary and only intended API. The REST routes exist
for development inspection and are not reachable through the gateway.
"""

from .risk_procedure import create_risk_rpc_server

__all__ = ["create_risk_rpc_server"]
