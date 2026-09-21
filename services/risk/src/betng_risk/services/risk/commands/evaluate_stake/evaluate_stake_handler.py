from __future__ import annotations

import logging
import uuid
from collections.abc import Callable
from datetime import datetime
from decimal import Decimal

from betng_service_kit import CommandHandler

from .....constants import RiskCommand
from .....dtos import RiskDecision
from .....engine import SlipLeg, decide, odds_fraction, total_odds
from .....interfaces import RiskRepository
from .....types import DecisionRecord
from .....utils import to_exposure_book
from .evaluate_stake_command import EvaluateStakeCommand

#: Ceiling of ``risk_decisions.total_odds`` (``numeric(12,2)``); stored odds are capped.
MAX_STORED_TOTAL_ODDS = Decimal("9999999999.99")

TWO_PLACES = Decimal("0.01")


class EvaluateStakeHandler(CommandHandler[EvaluateStakeCommand, RiskDecision]):
    message_type = RiskCommand.EVALUATE_STAKE

    def __init__(
        self,
        repository: RiskRepository,
        clock: Callable[[], datetime],
        logger: logging.Logger,
    ) -> None:
        self._repository = repository
        self._clock = clock
        self._logger = logger

    async def execute(self, message: EvaluateStakeCommand) -> RiskDecision:
        """Decide the slip from global exposure; the actor is only recorded."""
        request = message.request
        legs = [
            SlipLeg(
                match_id=str(leg.match_id),
                market_id=str(leg.market_id),
                selection_id=str(leg.selection_id),
                odds=leg.odds,
            )
            for leg in request.legs
        ]

        record = await self._repository.load_limits()
        states = await self._repository.load_selection_states(
            [leg.selection_id for leg in legs]
        )
        book = await self._repository.load_book(sorted({leg.match_id for leg in legs}))

        outcome = decide(
            stake=request.stake,
            legs=legs,
            limits=record.limits,
            states=states,
            book=to_exposure_book(book),
            now=self._clock(),
        )

        decision_id = uuid.uuid4()
        numerator, denominator = odds_fraction([leg.odds for leg in legs])

        await self._repository.insert_decision(
            DecisionRecord(
                id=str(decision_id),
                request_id=message.request_id,
                actor_kind=request.actor.kind,
                actor_id=str(request.actor.id),
                shop_id=(
                    str(request.actor.shop_id)
                    if request.actor.shop_id is not None
                    else None
                ),
                stake_requested=request.stake,
                total_odds=min(
                    total_odds(numerator, denominator), MAX_STORED_TOTAL_ODDS
                ),
                decision=outcome.decision,
                reason=outcome.reason,
                max_stake=outcome.max_stake,
                legs=[
                    {
                        "matchId": leg.match_id,
                        "marketId": leg.market_id,
                        "selectionId": leg.selection_id,
                        "odds": str(leg.odds.quantize(TWO_PLACES)),
                    }
                    for leg in legs
                ],
                limits_version=record.limits.version,
            )
        )

        self._logger.info(
            "Stake evaluated",
            extra={
                "requestId": message.request_id,
                "event": "risk_decision",
                "decisionId": str(decision_id),
                "decision": outcome.decision,
                "reason": outcome.reason,
                "legs": len(legs),
            },
        )

        return RiskDecision(
            decision_id=decision_id,
            decision=outcome.decision,
            reason=outcome.reason,
            max_stake=outcome.max_stake,
        )
