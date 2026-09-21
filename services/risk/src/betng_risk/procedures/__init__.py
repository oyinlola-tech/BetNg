"""The risk service's RPC surface."""

from .risk_procedure import create_risk_rpc_router, create_risk_rpc_server

__all__ = ["create_risk_rpc_router", "create_risk_rpc_server"]
