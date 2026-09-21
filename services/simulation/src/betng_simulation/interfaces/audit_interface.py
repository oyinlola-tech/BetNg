"""The audit trail, as the simulation service sees it."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal, Protocol

AuditSeverity = Literal["INFO", "NOTICE", "WARNING", "CRITICAL"]

SYSTEM_ACTOR_ID = "system"
SYSTEM_ACTOR_ROLE = "SYSTEM"


@dataclass(frozen=True)
class AuditEntry:
    """Payload of ``identity.recordAudit``."""

    actor_id: str
    actor_role: str
    action: str
    entity_type: str
    entity_id: str
    request_id: str
    before: dict[str, Any] | None = None
    after: dict[str, Any] | None = None
    reason: str | None = None
    severity: AuditSeverity = "INFO"


class AuditRecorder(Protocol):
    """Writes audit entries; injected so tests need no network."""

    async def record(self, entry: AuditEntry) -> None:
        """Write one entry, or raise when it could not be written."""
        ...
