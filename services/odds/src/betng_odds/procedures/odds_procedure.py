from __future__ import annotations

from typing import Any

from betng_service_kit import CommandBus, RpcProcedure, RpcServer

from ..constants import OddsProcedure
from ..dtos import (
    PublishMarketsRequest,
    RecalculateOddsResult,
    SetMatchMarketsStatusRequest,
)
from ..middlewares import current_request_id
from ..services.odds.commands import (
    PublishMarketsCommand,
    RecalculateOddsCommand,
    SetMatchMarketsStatusCommand,
)


class RecalculateOddsRequest:
    """Inline request model for odds recalculation."""

    def __init__(self, match_id: str, event_type: str, minute: int,
                 score_home: int, score_away: int) -> None:
        self.match_id = match_id
        self.event_type = event_type
        self.minute = minute
        self.score_home = score_home
        self.score_away = score_away


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

    async def recalculate_odds(payload: dict[str, Any]) -> dict[str, Any]:
        command = RecalculateOddsCommand(
            match_id=payload["matchId"],
            event_type=payload["eventType"],
            minute=payload.get("minute", 0),
            score_home=payload.get("scoreHome", 0),
            score_away=payload.get("scoreAway", 0),
            request_id=current_request_id(),
        )
        result = await command_bus.execute(command)
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
        )
    )

    return server
