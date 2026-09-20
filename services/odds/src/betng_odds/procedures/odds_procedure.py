"""The odds service's RPC procedures.

Odds is RPC-primary. Its caller is the betting service, on the bet-placement
path, asking "what is this selection worth right now?". That call wants a
procedure name, a typed payload, a typed error and a deadline — not a resource
URL and a status code to interpret. REST remains available for debugging and
analytics, as `docs/api/rpc.md` records.

The procedures dispatch onto the same buses the REST controller uses, so
there is one implementation of each operation.
"""

from __future__ import annotations

from betng_service_kit import CommandBus, QueryBus, RpcProcedure, RpcServer

from ..constants import OddsProcedure
from ..dtos import CalculateOddsRequest, GetMatchOddsRequest, MatchOdds
from ..services.odds.commands import GenerateOddsCommand
from ..services.odds.queries import GetMatchOddsQuery


def create_odds_rpc_server(
    command_bus: CommandBus, query_bus: QueryBus
) -> RpcServer:
    server = RpcServer()

    async def calculate_odds(payload: CalculateOddsRequest) -> MatchOdds:
        return await command_bus.execute(GenerateOddsCommand(payload))

    async def get_match_odds(payload: GetMatchOddsRequest) -> MatchOdds:
        return await query_bus.execute(GetMatchOddsQuery(payload.matchId))

    server.register(
        RpcProcedure(
            name=OddsProcedure.CALCULATE_ODDS,
            handler=calculate_odds,
            payload_model=CalculateOddsRequest,
        )
    )
    server.register(
        RpcProcedure(
            name=OddsProcedure.GET_MATCH_ODDS,
            handler=get_match_odds,
            payload_model=GetMatchOddsRequest,
        )
    )

    return server
