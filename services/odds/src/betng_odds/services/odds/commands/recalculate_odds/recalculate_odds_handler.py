from __future__ import annotations

import logging
from dataclasses import dataclass

from betng_service_kit import CommandHandler

from .....constants import (
    BETTABLE_LIFECYCLES,
    OddsCommand,
    SnapshotReasonValue,
)
from .....dtos import MatchState, RecalculateOddsResult, TeamStrength
from .....errors import OddsUnavailableError
from .....interfaces import (
    EventPublisher,
    MatchDirectory,
    OddsRepository,
    ProbabilityModel,
)
from .....pricing import derive_market_probabilities, price_markets
from .recalculate_odds_command import RecalculateOddsCommand


@dataclass(frozen=True)
class RecalculateOddsHandler(
    CommandHandler[RecalculateOddsCommand, RecalculateOddsResult]
):
    """Recalculate odds when a significant match event occurs during live play.

    On a goal, red card, or half-time, this handler:
    1. Fetches current team strengths from the match directory
    2. Recalculates the probability matrix with the simulation service
    3. Reprices all markets
    4. Persists updated odds and snapshots
    5. Publishes an odds update event
    """

    repository: OddsRepository
    probability_model: ProbabilityModel
    match_directory: MatchDirectory
    event_publisher: EventPublisher
    logger: logging.Logger

    message_type = OddsCommand.RECALCULATE_ODDS

    async def execute(self, message: RecalculateOddsCommand) -> RecalculateOddsResult:
        match_id = message.match_id

        existing = await self.repository.find_publication(match_id)
        if existing is None:
            self.logger.warning(
                "No markets found for recalculation",
                extra={"matchId": match_id, "requestId": message.request_id},
            )
            return RecalculateOddsResult(
                match_id=match_id,
                markets=0,
                odds_version=0,
                recalculated=False,
            )

        match = (await self.match_directory.find([match_id])).get(match_id)
        if match is None:
            self.logger.warning(
                "Match not found for recalculation",
                extra={"matchId": match_id, "requestId": message.request_id},
            )
            return RecalculateOddsResult(
                match_id=match_id,
                markets=0,
                odds_version=existing.odds_version,
                recalculated=False,
            )

        if match.lifecycle not in BETTABLE_LIFECYCLES:
            self.logger.info(
                "Match not bettable, skipping recalculation",
                extra={
                    "matchId": match_id,
                    "lifecycle": match.lifecycle,
                    "requestId": message.request_id,
                },
            )
            return RecalculateOddsResult(
                match_id=match_id,
                markets=0,
                odds_version=existing.odds_version,
                recalculated=False,
            )

        if match.home_strength is None or match.away_strength is None:
            self.logger.warning(
                "Team strengths not available for recalculation",
                extra={"matchId": match_id, "requestId": message.request_id},
            )
            return RecalculateOddsResult(
                match_id=match_id,
                markets=0,
                odds_version=existing.odds_version,
                recalculated=False,
            )

        home = TeamStrength(**match.home_strength)
        away = TeamStrength(**match.away_strength)

        # Without the live state the model would answer the pre-match matrix and
        # the "recalculation" would republish the price the goal just invalidated.
        state = MatchState(
            minute=message.minute,
            home_goals=message.score_home,
            away_goals=message.score_away,
            home_reds=message.home_reds,
            away_reds=message.away_reds,
        )

        try:
            matrix = await self.probability_model.calculate(
                match_id, home, away, message.request_id, state
            )
        except Exception as error:
            self.logger.error(
                "Probability model failed during recalculation",
                extra={"matchId": match_id, "requestId": message.request_id},
            )
            raise OddsUnavailableError(
                "Could not recalculate odds for the live event."
            ) from error

        try:
            probabilities = derive_market_probabilities(
                matrix.score_matrix, match.home_short_name, match.away_short_name
            )
        except Exception as error:
            self.logger.error(
                "Score matrix rejected during recalculation",
                extra={"matchId": match_id, "requestId": message.request_id},
            )
            raise OddsUnavailableError(
                "The probability model produced an unusable matrix."
            ) from error

        configuration = await self.repository.get_active_configuration()
        priced = price_markets(probabilities, configuration.pricing)

        await self.repository.publish_markets(
            match_id,
            priced,
            configuration.pricing.version,
            matrix.model_version,
            matrix.configuration_version,
        )

        reason = self._snapshot_reason(message.event_type)
        await self.repository.record_snapshot(
            match_id, existing.odds_version + 1, reason
        )

        self.logger.info(
            "Odds recalculated for live event",
            extra={
                "matchId": match_id,
                "requestId": message.request_id,
                "eventType": message.event_type,
                "minute": message.minute,
                "score": f"{message.score_home}-{message.score_away}",
                "markets": existing.markets,
                "oddsVersion": existing.odds_version + 1,
            },
        )

        try:
            await self.event_publisher.publish_odds_updated(
                match_id,
                f"Odds updated after {message.event_type.lower()} "
                f"at minute {message.minute}",
                message.request_id,
            )
        except Exception:
            self.logger.warning(
                "ODDS_UPDATED event could not be published",
                extra={"matchId": match_id, "requestId": message.request_id},
                exc_info=True,
            )

        return RecalculateOddsResult(
            match_id=match_id,
            markets=existing.markets,
            odds_version=existing.odds_version + 1,
            recalculated=True,
        )

    @staticmethod
    def _snapshot_reason(event_type: str) -> str:
        mapping = {
            "GOAL": SnapshotReasonValue.GOAL,
            "RED_CARD": SnapshotReasonValue.RED_CARD,
            "HALF_TIME": SnapshotReasonValue.HALF_TIME,
            "SECOND_HALF": SnapshotReasonValue.SECOND_HALF,
        }
        return mapping.get(event_type, SnapshotReasonValue.STATUS_CHANGE)
