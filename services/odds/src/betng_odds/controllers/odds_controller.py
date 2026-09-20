"""Odds HTTP handlers.

REST is the odds service's *secondary* API: it exists for debugging, manual
inspection and analytics. The betting service reaches odds by RPC, because a
price lookup on the bet-placement path wants a typed procedure and a deadline,
not a resource URL. See `docs/api/rpc.md`.

Both doors dispatch onto the same buses, so there is one implementation of
each operation.
"""

from __future__ import annotations

from betng_service_kit import CommandBus, QueryBus

from ..dtos import CalculateOddsRequest, MatchOdds
from ..services.odds.commands import GenerateOddsCommand
from ..services.odds.queries import GetMatchOddsQuery


class OddsController:
    def __init__(self, command_bus: CommandBus, query_bus: QueryBus) -> None:
        self._command_bus = command_bus
        self._query_bus = query_bus

    async def get_match_odds(self, match_id: str) -> MatchOdds:
        return await self._query_bus.execute(GetMatchOddsQuery(match_id))

    async def generate_odds(self, request: CalculateOddsRequest) -> MatchOdds:
        return await self._command_bus.execute(GenerateOddsCommand(request))
