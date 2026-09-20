"""The risk service's RPC procedures.

Risk is RPC-primary and internal. Its caller is the betting service, while a
market is still open, asking "what are we carrying if this selection wins?".
That is a typed computation with a deadline, not a resource to browse — and it
must never be reachable from a public client, which is the second reason it is
RPC rather than a gateway-forwarded REST route.

Both procedures dispatch onto the same query bus the REST controller uses.
"""

from __future__ import annotations

from betng_service_kit import QueryBus, RpcProcedure, RpcServer

from ..constants import RiskProcedure
from ..dtos import ExposureReport, ExposureRequest
from ..services.risk.queries import EvaluateExposureQuery


def create_risk_rpc_server(query_bus: QueryBus) -> RpcServer:
    """Build the RPC server holding the risk procedures.

    Args:
        query_bus: The bus the read handlers are registered on.

    Returns:
        The server to mount at ``POST /rpc``.
    """
    server = RpcServer()

    async def evaluate(payload: ExposureRequest) -> ExposureReport:
        return await query_bus.execute(EvaluateExposureQuery(payload))

    # Exposure and liability are two readings of one analysis: the report
    # carries both the total stake and the worst-case liability. They are
    # separate procedure names because callers ask different questions, and
    # the answers will diverge once limits and per-market rules exist.
    server.register(
        RpcProcedure(
            name=RiskProcedure.CALCULATE_EXPOSURE,
            handler=evaluate,
            payload_model=ExposureRequest,
        )
    )
    server.register(
        RpcProcedure(
            name=RiskProcedure.CALCULATE_LIABILITY,
            handler=evaluate,
            payload_model=ExposureRequest,
        )
    )

    return server
