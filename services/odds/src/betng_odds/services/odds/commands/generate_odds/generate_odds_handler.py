"""The handler behind ``odds.calculateOdds``."""

from __future__ import annotations

from betng_service_kit import CommandHandler

from .....constants import OddsCommand
from .....dtos import MatchOdds
from .....interfaces import OddsPricer
from .generate_odds_command import GenerateOddsCommand


class GenerateOddsHandler(CommandHandler[GenerateOddsCommand, MatchOdds]):
    """Prices a match's markets through the pricer."""

    message_type = OddsCommand.GENERATE_ODDS

    def __init__(self, pricer: OddsPricer) -> None:
        """Price through the given pricer."""
        self._pricer = pricer

    async def execute(self, message: GenerateOddsCommand) -> MatchOdds:
        """Price the match named in the command."""
        return await self._pricer.price(
            message.request.matchId, message.request.probabilities
        )
