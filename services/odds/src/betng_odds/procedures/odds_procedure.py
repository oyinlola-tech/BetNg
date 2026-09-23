from __future__ import annotations

from typing import Any

from betng_service_kit import CommandBus, RpcProcedure, RpcServer

from ..constants import OddsProcedure
from ..dtos import (
    PublishMarketsRequest,
    RecalculateOddsRequest,
    SetMatchMarketsStatusRequest,
)
from ..middlewares import current_request_id
from ..services.odds.commands import (
    PublishMarketsCommand,
    RecalculateOddsCommand,
    SetMatchMarketsStatusCommand,
)


def create_odds_rpc_server(command_bus: CommandBus) -> RpcServer:
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

    async def recalculate_odds(payload: RecalculateOddsRequest) -> dict[str, Any]:
        result = await command_bus.execute(
            RecalculateOddsCommand(
                match_id=str(payload.match_id),
                event_type=payload.event_type,
                minute=payload.state.minute,
                score_home=payload.state.home_goals,
                score_away=payload.state.away_goals,
                home_reds=payload.state.home_reds,
                away_reds=payload.state.away_reds,
                request_id=current_request_id(),
            )
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
    server.register(
        RpcProcedure(
            name=OddsProcedure.RECALCULATE_ODDS,
            handler=recalculate_odds,
            payload_model=RecalculateOddsRequest,
        )
    )

    return server
