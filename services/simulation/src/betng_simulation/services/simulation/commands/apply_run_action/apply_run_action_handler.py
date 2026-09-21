from __future__ import annotations

import logging

from betng_service_kit import CommandHandler

from .....constants import AuditEntity, SimulationAuditAction, SimulationCommand
from .....dtos import AdminSimulationRun
from .....errors import (
    ResultImmutableError,
    RunActionConflictError,
    SimulationRunNotFoundError,
)
from .....interfaces import AuditEntry, MatchReadModel
from .....middlewares import current_request_id
from .....repositories import SimulationRepository
from .....utils import BackgroundAuditor, to_admin_run
from .apply_run_action_command import ApplyRunActionCommand

COMPLETED = "COMPLETED"
FAILED = "FAILED"
RETRY = "RETRY"


class ApplyRunActionHandler(CommandHandler[ApplyRunActionCommand, AdminSimulationRun]):
    """Flags a failed run for retry or cancels it; never simulates."""

    message_type = SimulationCommand.APPLY_RUN_ACTION

    def __init__(
        self,
        repository: SimulationRepository,
        match_read_model: MatchReadModel,
        auditor: BackgroundAuditor,
        logger: logging.Logger,
    ) -> None:
        self._repository = repository
        self._match_read_model = match_read_model
        self._auditor = auditor
        self._logger = logger

    async def execute(self, message: ApplyRunActionCommand) -> AdminSimulationRun:
        action = message.request.action
        reason = message.request.reason

        async with self._repository.transaction() as connection:
            run = await self._repository.lock_run(connection, message.run_id)

            if run is None:
                raise SimulationRunNotFoundError

            has_result = (
                await self._repository.get_result(connection, run.match_id) is not None
            )
            if run.status == COMPLETED or has_result:
                raise ResultImmutableError

            if run.status != FAILED:
                raise RunActionConflictError(
                    "Only a failed run can be retried or cancelled."
                )

            if action == RETRY:
                applied = await self._repository.request_retry(
                    connection, run.id, message.actor.id, reason
                )
                if not applied:
                    raise RunActionConflictError(
                        "A retry has already been requested for this run."
                    )
            else:
                applied = await self._repository.cancel_run(connection, run.id, reason)
                if not applied:
                    raise RunActionConflictError("The run could not be cancelled.")

            record = await self._repository.get_admin_run(connection, run.id)

        if record is None:
            raise SimulationRunNotFoundError

        audit_action = (
            SimulationAuditAction.RETRY_REQUESTED
            if action == RETRY
            else SimulationAuditAction.CANCELLED
        )
        self._logger.info(
            "Simulation run action applied",
            extra={
                "matchId": run.match_id,
                "simulationId": run.id,
                "event": audit_action,
                "actorId": message.actor.id,
            },
        )
        self._auditor.submit(
            AuditEntry(
                actor_id=message.actor.id,
                actor_role=message.actor.role,
                action=audit_action,
                entity_type=AuditEntity.SIMULATION,
                entity_id=run.id,
                request_id=current_request_id(),
                before={"status": run.status},
                after={"status": record.admin_status, "matchId": run.match_id},
                reason=reason,
                severity="NOTICE",
            )
        )

        matches = await self._match_read_model.get_matches([run.match_id])

        return to_admin_run(record, matches.get(run.match_id))
