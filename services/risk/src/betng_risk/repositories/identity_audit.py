from __future__ import annotations

import logging

from betng_service_kit import RpcClient, RpcError

from ..errors import AuditUnavailableError
from ..interfaces import AuditRecorder
from ..types import AuditEntry

RECORD_AUDIT_PROCEDURE = "identity.recordAudit"


class IdentityAuditRecorder(AuditRecorder):
    """Calls ``identity.recordAudit``; any failure refuses the change."""

    def __init__(self, client: RpcClient, logger: logging.Logger) -> None:
        self._client = client
        self._logger = logger

    async def record(self, entry: AuditEntry) -> None:
        """Write the entry or raise ``AuditUnavailableError``."""
        payload = {
            "actorId": entry.actor_id,
            "actorRole": entry.actor_role,
            "action": entry.action,
            "entityType": entry.entity_type,
            "entityId": entry.entity_id,
            "before": entry.before,
            "after": entry.after,
            "reason": entry.reason,
            "severity": entry.severity,
            "requestId": entry.request_id,
        }

        try:
            await self._client.call(
                RECORD_AUDIT_PROCEDURE, payload, request_id=entry.request_id
            )
        except (RpcError, ValueError) as error:
            self._logger.error(
                "Audit entry could not be written",
                extra={
                    "requestId": entry.request_id,
                    "event": entry.action,
                    "error": getattr(error, "code", type(error).__name__),
                },
            )
            raise AuditUnavailableError from error
