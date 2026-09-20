from __future__ import annotations

from betng_service_kit import CommandHandler

from .....constants import OddsCommand
from .....dtos import MatchOdds
from .....interfaces import OddsPricer
from .generate_odds_command import GenerateOddsCommand


class GenerateOddsHandler(CommandHandler[GenerateOddsCommand, MatchOdds]):
    message_type = OddsCommand.GENERATE_ODDS

    def __init__(self, pricer: OddsPricer) -> None:
        self._pricer = pricer

    async def execute(self, message: GenerateOddsCommand) -> MatchOdds:
        return await self._pricer.price(
            message.request.matchId, message.request.probabilities
        )
