from __future__ import annotations

from betng_service_kit import CommandBus, Container, QueryBus

from ...constants import ODDS_PRICER_TOKEN
from .commands import GenerateOddsHandler
from .queries import GetMatchOddsHandler


def register_odds_service(
    container: Container, command_bus: CommandBus, query_bus: QueryBus
) -> None:
    pricer = container.resolve(ODDS_PRICER_TOKEN)

    command_bus.register(GenerateOddsHandler(pricer))
    query_bus.register(GetMatchOddsHandler(pricer))
