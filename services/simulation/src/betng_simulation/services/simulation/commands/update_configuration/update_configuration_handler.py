from __future__ import annotations

import logging

from betng_service_kit import CommandHandler, ServiceError

from .....constants import AuditEntity, SimulationAuditAction, SimulationCommand
from .....dtos import ModelConfigurationView
from .....engine import MODEL_VERSION
from .....errors import AuditUnavailableError, InvalidConfigurationError
from .....interfaces import AuditEntry, AuditRecorder
from .....middlewares import current_request_id
from .....repositories import SimulationRepository
from .....utils import build_configuration, parameters_of, parameters_to_json
from .update_configuration_command import UpdateConfigurationCommand

REASON_FIELD = "reason"


class UpdateConfigurationHandler(
    CommandHandler[UpdateConfigurationCommand, ModelConfigurationView]
):
    """Activates a new version; refused unless its audit entry is written."""

    message_type = SimulationCommand.UPDATE_CONFIGURATION

    def __init__(
        self,
        repository: SimulationRepository,
        recorder: AuditRecorder,
        logger: logging.Logger,
    ) -> None:
        self._repository = repository
        self._recorder = recorder
        self._logger = logger

    async def execute(
        self, message: UpdateConfigurationCommand
    ) -> ModelConfigurationView:
        request = message.request
        changes = {
            name: getattr(request, name)
            for name in request.model_fields_set
            if name != REASON_FIELD
        }

        if not changes:
            raise InvalidConfigurationError("At least one parameter must be supplied.")

        async with self._repository.transaction() as connection:
            await self._repository.lock_configurations(connection)
            current = await self._repository.get_active_configuration(connection)
            version = await self._repository.next_configuration_version(connection)
            configuration = build_configuration(
                version, MODEL_VERSION, changes, base=current.configuration
            )
            stored = await self._repository.activate_new_configuration(
                connection, configuration, message.actor.id, request.reason
            )

            try:
                await self._recorder.record(
                    AuditEntry(
                        actor_id=message.actor.id,
                        actor_role=message.actor.role,
                        action=SimulationAuditAction.CONFIGURATION_CHANGED,
                        entity_type=AuditEntity.CONFIGURATION,
                        entity_id=str(version),
                        request_id=current_request_id(),
                        before={
                            "version": current.configuration.version,
                            "params": parameters_to_json(current.configuration),
                        },
                        after={
                            "version": version,
                            "params": parameters_to_json(configuration),
                        },
                        reason=request.reason,
                        severity="WARNING",
                    )
                )
            except ServiceError:
                raise
            except Exception as error:
                self._logger.error(
                    "Configuration change refused: audit entry not written",
                    extra={
                        "event": SimulationAuditAction.CONFIGURATION_CHANGED,
                        "errorType": type(error).__name__,
                    },
                )
                raise AuditUnavailableError from error

        self._logger.info(
            "Model configuration changed",
            extra={
                "event": SimulationAuditAction.CONFIGURATION_CHANGED,
                "configurationVersion": version,
                "actorId": message.actor.id,
            },
        )

        return ModelConfigurationView(
            version=stored.configuration.version,
            model_version=stored.configuration.model_version,
            active=stored.active,
            params=parameters_of(stored.configuration),
            created_at=stored.created_at,
            created_by=stored.created_by,
            reason=stored.reason,
        )
