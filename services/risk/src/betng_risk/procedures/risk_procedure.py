"""The risk RPC procedures; none can change a bet, price, match or result."""

from __future__ import annotations

from typing import Any

from betng_service_kit import (
    RPC_PATH,
    RPC_PROCEDURE_NOT_FOUND,
    CommandBus,
    RpcProcedure,
    RpcRequestFrame,
    RpcResponseFrame,
    RpcServer,
    get_request_id,
    is_internal_request,
)
from betng_service_kit.rpc import RpcErrorPayload
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..constants import RiskProcedure
from ..dtos import FreezeExposureRequest, RiskEvaluateRequest, WireModel
from ..middlewares import current_rpc_request_id, safe_request_id, set_rpc_request_id
from ..services.risk.commands import EvaluateStakeCommand, FreezeExposureCommand


def _wire(result: WireModel) -> dict[str, Any]:
    return result.model_dump(mode="json", by_alias=True, exclude_none=True)


def create_risk_rpc_server(command_bus: CommandBus) -> RpcServer:
    """Register the risk procedures."""
    server = RpcServer()

    async def evaluate(payload: RiskEvaluateRequest) -> dict[str, Any]:
        decision = await command_bus.execute(
            EvaluateStakeCommand(payload, current_rpc_request_id())
        )

        return _wire(decision)

    async def freeze_exposure(payload: FreezeExposureRequest) -> dict[str, Any]:
        frozen = await command_bus.execute(FreezeExposureCommand(str(payload.match_id)))

        return _wire(frozen)

    server.register(
        RpcProcedure(
            name=RiskProcedure.EVALUATE,
            handler=evaluate,
            payload_model=RiskEvaluateRequest,
        )
    )
    server.register(
        RpcProcedure(
            name=RiskProcedure.FREEZE_EXPOSURE,
            handler=freeze_exposure,
            payload_model=FreezeExposureRequest,
        )
    )

    return server


def create_risk_rpc_router(server: RpcServer) -> APIRouter:
    """Mount the server at ``POST /rpc`` behind the internal service token."""
    router = APIRouter(tags=["rpc"])

    @router.post(RPC_PATH, include_in_schema=False)
    async def handle_rpc(frame: RpcRequestFrame, request: Request) -> Any:
        if not is_internal_request(request):
            refusal = RpcResponseFrame(
                id=frame.id,
                success=False,
                error=RpcErrorPayload(
                    code=RPC_PROCEDURE_NOT_FOUND, message="Not found."
                ),
            )
            return JSONResponse(
                status_code=404, content=refusal.model_dump(exclude_none=True)
            )

        set_rpc_request_id(
            safe_request_id(frame.metadata.get("requestId")) or get_request_id(request)
        )
        response = await server.handle(frame)

        return response.model_dump(exclude_none=True)

    return router
