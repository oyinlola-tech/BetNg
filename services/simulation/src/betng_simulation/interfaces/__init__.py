"""Records and protocols."""

from .audit_interface import (
    SYSTEM_ACTOR_ID,
    SYSTEM_ACTOR_ROLE,
    AuditEntry,
    AuditRecorder,
    AuditSeverity,
)
from .match_interface import MATCH_COMPLETED, MatchReadModel, MatchView
from .simulation_interface import (
    AdminRunRecord,
    EventRecord,
    ResultRecord,
    RunRecord,
    Simulate,
    StoredConfiguration,
)

__all__ = [
    "MATCH_COMPLETED",
    "SYSTEM_ACTOR_ID",
    "SYSTEM_ACTOR_ROLE",
    "AdminRunRecord",
    "AuditEntry",
    "AuditRecorder",
    "AuditSeverity",
    "EventRecord",
    "MatchReadModel",
    "MatchView",
    "ResultRecord",
    "RunRecord",
    "Simulate",
    "StoredConfiguration",
]
