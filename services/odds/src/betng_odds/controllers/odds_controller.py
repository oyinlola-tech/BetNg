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
    """The handlers the odds routes bind to."""

    def __init__(self, command_bus: CommandBus, query_bus: QueryBus) -> None:
        """Dispatch through the given buses."""
        self._command_bus = command_bus
        self._query_bus = query_bus

    async def get_match_odds(self, match_id: str) -> MatchOdds:
        """Return the markets currently priced for a match.

        Args:
            match_id: The match to read.

        Returns:
            Every market currently priced for it.
        """
        return await self._query_bus.execute(GetMatchOddsQuery(match_id))

    async def generate_odds(self, request: CalculateOddsRequest) -> MatchOdds:
        """Price a match's markets from its probabilities.

        Args:
            request: The match and the probabilities to price from.

        Returns:
            The priced markets.
        """
        return await self._command_bus.execute(GenerateOddsCommand(request))
