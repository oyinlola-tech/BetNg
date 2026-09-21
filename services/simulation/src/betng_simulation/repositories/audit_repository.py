"""Writes audit entries through the identity service's RPC."""

from __future__ import annotations

from typing import Any

from betng_service_kit import RpcClient

from ..interfaces import AuditEntry, AuditRecorder

RECORD_AUDIT_PROCEDURE = "identity.recordAudit"


class IdentityAuditRecorder(AuditRecorder):
    """Writes audit entries through ``identity.recordAudit``."""

    def __init__(self, client: RpcClient) -> None:
        """Store the collaborators."""
        self._client = client

    async def record(self, entry: AuditEntry) -> None:
        """Write one entry or raise."""
        payload: dict[str, Any] = {
            "actorId": entry.actor_id,
            "actorRole": entry.actor_role,
            "action": entry.action,
            "entityType": entry.entity_type,
            "entityId": entry.entity_id,
            "severity": entry.severity,
            "requestId": entry.request_id,
        }

        if entry.before is not None:
            payload["before"] = entry.before
        if entry.after is not None:
            payload["after"] = entry.after
        if entry.reason is not None:
            payload["reason"] = entry.reason

        await self._client.call(
            RECORD_AUDIT_PROCEDURE, payload, request_id=entry.request_id
        )
