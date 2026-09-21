"""Writes a new limits version together with its audit entry."""

from __future__ import annotations

import logging

from betng_service_kit import CommandHandler

from .....constants import (
    AUDIT_ACTION_LIMITS_CHANGED,
    AUDIT_ENTITY_LIMITS,
    AUDIT_SEVERITY_LIMITS,
    RiskCommand,
)
from .....dtos import RiskLimits
from .....errors import InvalidLimitsError
from .....interfaces import AuditRecorder, RiskRepository
from .....types import AuditEntry, LimitsDraft, LimitsRecord
from ...limits_view import to_audit_view, to_risk_limits
from .update_limits_command import UpdateLimitsCommand


class UpdateLimitsHandler(CommandHandler[UpdateLimitsCommand, RiskLimits]):
    """Versions the limits; the change stands only if its audit entry does."""

    message_type = RiskCommand.UPDATE_LIMITS

    def __init__(
        self,
        repository: RiskRepository,
        audit: AuditRecorder,
        logger: logging.Logger,
    ) -> None:
        """Bind the handler to its collaborators."""
        self._repository = repository
        self._audit = audit
        self._logger = logger

    async def execute(self, message: UpdateLimitsCommand) -> RiskLimits:
        """Insert the next version, audited inside the same transaction."""
        request = message.request

        def draft(current: LimitsRecord) -> LimitsDraft:
            limits = current.limits
            amounts = LimitsDraft(
                min_stake=request.min_stake or limits.min_stake,
                max_stake_per_bet=(
                    request.max_stake_per_bet or limits.max_stake_per_bet
                ),
                max_payout_per_bet=(
                    request.max_payout_per_bet or limits.max_payout_per_bet
                ),
                max_liability_per_selection=(
                    request.max_liability_per_selection
                    or limits.max_liability_per_selection
                ),
                max_liability_per_market=(
                    request.max_liability_per_market or limits.max_liability_per_market
                ),
                max_liability_per_match=(
                    request.max_liability_per_match or limits.max_liability_per_match
                ),
            )

            if amounts.max_stake_per_bet < amounts.min_stake:
                raise InvalidLimitsError(
                    "The maximum stake per bet cannot be below the minimum stake."
                )
            if amounts.max_payout_per_bet < amounts.max_stake_per_bet:
                raise InvalidLimitsError(
                    "The maximum payout per bet cannot be below the maximum "
                    "stake per bet."
                )
            if amounts == LimitsDraft(
                min_stake=limits.min_stake,
                max_stake_per_bet=limits.max_stake_per_bet,
                max_payout_per_bet=limits.max_payout_per_bet,
                max_liability_per_selection=limits.max_liability_per_selection,
                max_liability_per_market=limits.max_liability_per_market,
                max_liability_per_match=limits.max_liability_per_match,
            ):
                raise InvalidLimitsError("No limit differs from the version in force.")

            return amounts

        async def audit(before: LimitsRecord, after: LimitsRecord) -> None:
            await self._audit.record(
                AuditEntry(
                    actor_id=message.actor_id,
                    actor_role=message.actor_role,
                    action=AUDIT_ACTION_LIMITS_CHANGED,
                    entity_type=AUDIT_ENTITY_LIMITS,
                    entity_id=str(after.limits.version),
                    before=to_audit_view(before),
                    after=to_audit_view(after),
                    reason=request.reason,
                    severity=AUDIT_SEVERITY_LIMITS,
                    request_id=message.request_id,
                )
            )

        created = await self._repository.replace_limits(
            draft,
            created_by=message.actor_id,
            reason=request.reason,
            before_commit=audit,
        )

        self._logger.info(
            "Risk limits changed",
            extra={
                "requestId": message.request_id,
                "event": AUDIT_ACTION_LIMITS_CHANGED,
                "limitsVersion": created.limits.version,
            },
        )

        return to_risk_limits(created)
