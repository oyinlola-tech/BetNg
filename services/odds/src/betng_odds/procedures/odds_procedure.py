"""The odds service's RPC procedures.

The match service drives the market lifecycle through these two calls. They
dispatch onto the same buses the REST controller uses, so there is one
implementation of each operation. Results are dumped by alias here because
the wire is camelCase.
"""

from __future__ import annotations

from typing import Any

from betng_service_kit import CommandBus, RpcProcedure, RpcServer

from ..constants import OddsProcedure
from ..dtos import PublishMarketsRequest, SetMatchMarketsStatusRequest
from ..middlewares import current_request_id
from ..services.odds.commands import (
    PublishMarketsCommand,
    SetMatchMarketsStatusCommand,
)


def create_odds_rpc_server(command_bus: CommandBus) -> RpcServer:
    """Register ``odds.publishMarkets`` and ``odds.setMatchMarketsStatus``."""
    server = RpcServer()

    async def publish_markets(payload: PublishMarketsRequest) -> dict[str, Any]:
        result = await command_bus.execute(
            PublishMarketsCommand(payload, current_request_id())
        )
        return result.model_dump(by_alias=True)

    async def set_match_markets_status(
        payload: SetMatchMarketsStatusRequest,
    ) -> dict[str, Any]:
        result = await command_bus.execute(
            SetMatchMarketsStatusCommand(payload, current_request_id())
        )
        return result.model_dump(by_alias=True)

    server.register(
        RpcProcedure(
            name=OddsProcedure.PUBLISH_MARKETS,
            handler=publish_markets,
            payload_model=PublishMarketsRequest,
        )
    )
    server.register(
        RpcProcedure(
            name=OddsProcedure.SET_MATCH_MARKETS_STATUS,
            handler=set_match_markets_status,
            payload_model=SetMatchMarketsStatusRequest,
        )
    )

    return server
