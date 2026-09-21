"""Score matrix to stored markets."""

from __future__ import annotations

import logging
from dataclasses import dataclass

from betng_service_kit import CommandHandler

from .....constants import OddsCommand
from .....dtos import PublishMarketsResult
from .....errors import MatchNotFoundError, OddsUnavailableError
from .....interfaces import MatchDirectory, OddsRepository, ProbabilityModel
from .....pricing import (
    InvalidScoreMatrixError,
    derive_market_probabilities,
    price_markets,
)
from .....types import PublishOutcome
from .publish_markets_command import PublishMarketsCommand


def _result(outcome: PublishOutcome) -> PublishMarketsResult:
    return PublishMarketsResult(
        match_id=outcome.match_id,
        markets=outcome.markets,
        odds_version=outcome.odds_version,
    )


@dataclass(frozen=True)
class PublishMarketsHandler(
    CommandHandler[PublishMarketsCommand, PublishMarketsResult]
):
    """Run the pricing pipeline for one match and persist version 1."""

    repository: OddsRepository
    probability_model: ProbabilityModel
    match_directory: MatchDirectory
    logger: logging.Logger

    message_type = OddsCommand.PUBLISH_MARKETS

    async def execute(self, message: PublishMarketsCommand) -> PublishMarketsResult:
        """Publish a match's markets, or return what is already published."""
        match_id = str(message.request.match_id)
        existing = await self.repository.find_publication(match_id)

        if existing is not None:
            return _result(existing)

        match = (await self.match_directory.find([match_id])).get(match_id)

        if match is None:
            raise MatchNotFoundError(match_id)

        matrix = await self.probability_model.calculate(
            message.request.home, message.request.away, message.request_id
        )

        try:
            probabilities = derive_market_probabilities(
                matrix.score_matrix, match.home_short_name, match.away_short_name
            )
        except InvalidScoreMatrixError as error:
            self.logger.error(
                "Score matrix rejected",
                extra={"matchId": match_id, "requestId": message.request_id},
            )
            raise OddsUnavailableError(
                "The probability model answered an unusable result, so no odds "
                "were published."
            ) from error

        configuration = (await self.repository.get_active_configuration()).pricing
        outcome = await self.repository.publish_markets(
            match_id,
            price_markets(probabilities, configuration),
            configuration.version,
            matrix.model_version,
            matrix.configuration_version,
        )

        if outcome.created:
            self.logger.info(
                "Markets published",
                extra={
                    "matchId": match_id,
                    "requestId": message.request_id,
                    "event": "markets_published",
                    "markets": outcome.markets,
                    "pricingVersion": configuration.version,
                },
            )

        return _result(outcome)
