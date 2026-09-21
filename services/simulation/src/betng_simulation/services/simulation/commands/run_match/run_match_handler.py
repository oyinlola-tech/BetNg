"""Run match handler."""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from typing import Final

from betng_service_kit import CommandHandler, ServiceError

from .....constants import AuditEntity, SimulationAuditAction, SimulationCommand
from .....dtos import MatchScoreResult, RunMatchResponse
from .....engine import ModelConfiguration, SimulationTeam, derive_seed
from .....errors import SimulationFailedError
from .....interfaces import SYSTEM_ACTOR_ID, SYSTEM_ACTOR_ROLE, AuditEntry, Simulate
from .....middlewares import current_request_id
from .....repositories import SimulationRepository
from .....repositories.simulation_repository import Connection
from .....utils import BackgroundAuditor
from .run_match_command import RunMatchCommand

COMPLETED: Final = "COMPLETED"
MAX_FAILURE_DETAIL = 200


@dataclass(frozen=True)
class _Attempt:
    run_id: str
    match_id: str
    home: SimulationTeam
    away: SimulationTeam
    configuration: ModelConfiguration
    seed: str


def _describe_failure(error: Exception) -> str:
    """Return a failure reason safe to store and show: never SQL or paths."""
    if isinstance(error, (ValueError, ArithmeticError)):
        return f"{type(error).__name__}: {str(error)[:MAX_FAILURE_DETAIL]}"

    return type(error).__name__


class RunMatchHandler(CommandHandler[RunMatchCommand, RunMatchResponse]):
    """Plays a match once: claim, result and events commit in one transaction."""

    message_type = SimulationCommand.RUN_MATCH

    def __init__(
        self,
        repository: SimulationRepository,
        simulate: Simulate,
        auditor: BackgroundAuditor,
        logger: logging.Logger,
    ) -> None:
        """Store the collaborators."""
        self._repository = repository
        self._simulate = simulate
        self._auditor = auditor
        self._logger = logger

    async def execute(self, message: RunMatchCommand) -> RunMatchResponse:
        """Execute the message."""
        request = message.request
        match_id = str(request.match_id)
        home = request.home.to_engine()
        away = request.away.to_engine()
        attempt: _Attempt | None = None
        started = False

        try:
            async with self._repository.transaction() as connection:
                stored = await self._repository.get_active_configuration(connection)
                configuration = stored.configuration
                attempt = _Attempt(
                    run_id=str(uuid.uuid4()),
                    match_id=match_id,
                    home=home,
                    away=away,
                    configuration=configuration,
                    seed=derive_seed(
                        match_id, configuration.model_version, configuration.version
                    ),
                )

                claimed = await self._repository.claim_run(
                    connection,
                    attempt.run_id,
                    match_id,
                    configuration,
                    attempt.seed,
                    home,
                    away,
                )

                if not claimed:
                    return await self._stored_run(connection, match_id)

                started = True
                self._logger.info(
                    "Simulation started",
                    extra=self._log_context(attempt, SimulationAuditAction.STARTED),
                )

                output = self._simulate(match_id, home, away, configuration)
                await self._repository.store_output(connection, attempt.run_id, output)
        except ServiceError:
            raise
        except Exception as error:
            await self._record_failure(match_id, attempt, error, started=started)
            raise SimulationFailedError from error

        assert attempt is not None
        self._logger.info(
            "Simulation completed",
            extra={
                **self._log_context(attempt, SimulationAuditAction.COMPLETED),
                "eventCount": len(output.events),
            },
        )
        self._auditor.submit(
            self._audit(attempt, SimulationAuditAction.STARTED),
            self._audit(attempt, SimulationAuditAction.COMPLETED),
        )

        result = output.result

        return RunMatchResponse(
            simulation_id=uuid.UUID(attempt.run_id),
            match_id=request.match_id,
            status=COMPLETED,
            duplicate=False,
            model_version=result.model_version,
            configuration_version=result.configuration_version,
            seed=result.seed,
            result=MatchScoreResult(
                home_goals=result.home_goals,
                away_goals=result.away_goals,
                winner=result.winner,
                winning_gap=result.winning_gap,
            ),
            event_count=len(output.events),
        )

    async def _stored_run(
        self, connection: Connection, match_id: str
    ) -> RunMatchResponse:
        run = await self._repository.get_live_run(connection, match_id)
        result = await self._repository.get_result(connection, match_id)

        if run is None or result is None or run.status != COMPLETED:
            raise SimulationFailedError

        self._logger.info(
            "Simulation already stored; returning it",
            extra={
                "matchId": match_id,
                "simulationId": run.id,
                "event": "simulation_duplicate",
            },
        )

        return RunMatchResponse.model_validate(
            {
                "simulation_id": run.id,
                "match_id": match_id,
                "status": COMPLETED,
                "duplicate": True,
                "model_version": run.model_version,
                "configuration_version": run.configuration_version,
                "seed": run.seed,
                "result": {
                    "home_goals": result.home_goals,
                    "away_goals": result.away_goals,
                    "winner": result.winner,
                    "winning_gap": result.winning_gap,
                },
                "event_count": await self._repository.count_events(
                    connection, match_id
                ),
            }
        )

    async def _record_failure(
        self,
        match_id: str,
        attempt: _Attempt | None,
        error: Exception,
        *,
        started: bool,
    ) -> None:
        reason = _describe_failure(error)
        self._logger.error(
            "Simulation failed",
            exc_info=error,
            extra={
                "matchId": match_id,
                "simulationId": attempt.run_id if attempt else None,
                "event": SimulationAuditAction.FAILED,
                "failureReason": reason,
            },
        )

        if attempt is None:
            return

        # Separate transaction: the run's own rolled back. FAILED rows sit
        # outside the lock index, so they never block a retry.
        try:
            async with self._repository.transaction() as connection:
                await self._repository.record_failed_run(
                    connection,
                    attempt.run_id,
                    match_id,
                    attempt.configuration,
                    attempt.seed,
                    attempt.home,
                    attempt.away,
                    reason,
                )
        except Exception:
            self._logger.exception(
                "The failed run could not be recorded",
                extra={"matchId": match_id, "simulationId": attempt.run_id},
            )

        failed = self._audit(attempt, SimulationAuditAction.FAILED, reason)
        if started:
            self._auditor.submit(
                self._audit(attempt, SimulationAuditAction.STARTED), failed
            )
        else:
            self._auditor.submit(failed)

    @staticmethod
    def _log_context(attempt: _Attempt, event: str) -> dict[str, object]:
        return {
            "matchId": attempt.match_id,
            "simulationId": attempt.run_id,
            "event": event,
            "modelVersion": attempt.configuration.model_version,
            "configurationVersion": attempt.configuration.version,
        }

    @staticmethod
    def _audit(attempt: _Attempt, action: str, reason: str | None = None) -> AuditEntry:
        # The audit trail is gateway-readable, so an entry never carries the score.
        return AuditEntry(
            actor_id=SYSTEM_ACTOR_ID,
            actor_role=SYSTEM_ACTOR_ROLE,
            action=action,
            entity_type=AuditEntity.SIMULATION,
            entity_id=attempt.run_id,
            request_id=current_request_id(),
            after={
                "matchId": attempt.match_id,
                "modelVersion": attempt.configuration.model_version,
                "configurationVersion": attempt.configuration.version,
            },
            reason=reason,
            severity="WARNING" if action == SimulationAuditAction.FAILED else "INFO",
        )
