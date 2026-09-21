from __future__ import annotations

from typing import Final

SCHEMA: Final = "risk"


class RiskCommand:
    EVALUATE_STAKE: Final = "risk.evaluateStake"
    FREEZE_EXPOSURE: Final = "risk.freezeExposure"
    UPDATE_LIMITS: Final = "risk.updateLimits"


class RiskQuery:
    GET_MATCH_EXPOSURE: Final = "risk.getMatchExposure"
    LIST_EXPOSURE: Final = "risk.listExposure"
    GET_OVERVIEW: Final = "risk.getOverview"
    GET_LIMITS: Final = "risk.getLimits"


class RiskProcedure:
    EVALUATE: Final = "risk.evaluate"
    FREEZE_EXPOSURE: Final = "risk.freezeExposure"


class RiskPermission:
    """Admin permissions, as named in ``adminPermissionSchema``."""

    READ: Final = "risk:read"
    WRITE: Final = "risk:write"


ADMIN_ACTOR_KIND: Final = "ADMIN"

AUDIT_ACTION_LIMITS_CHANGED: Final = "risk_configuration_changed"
AUDIT_ENTITY_LIMITS: Final = "risk_limits"
AUDIT_SEVERITY_LIMITS: Final = "WARNING"

DECISION_WINDOW_HOURS: Final = 24

DASHBOARD_MATCH_LIMIT: Final = 200
