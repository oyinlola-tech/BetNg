"""Names the risk service routes, registers and checks against."""

from __future__ import annotations

from typing import Final

SCHEMA: Final = "risk"


class RiskCommand:
    """Command types. Each writes only to the ``risk`` schema."""

    EVALUATE_STAKE: Final = "risk.evaluateStake"
    FREEZE_EXPOSURE: Final = "risk.freezeExposure"
    UPDATE_LIMITS: Final = "risk.updateLimits"


class RiskQuery:
    """Query types."""

    GET_MATCH_EXPOSURE: Final = "risk.getMatchExposure"
    LIST_EXPOSURE: Final = "risk.listExposure"
    GET_OVERVIEW: Final = "risk.getOverview"
    GET_LIMITS: Final = "risk.getLimits"


class RiskProcedure:
    """RPC procedure names, as in the architecture's procedure table."""

    EVALUATE: Final = "risk.evaluate"
    FREEZE_EXPOSURE: Final = "risk.freezeExposure"


class RiskPermission:
    """Admin permissions, as named in ``adminPermissionSchema``."""

    READ: Final = "risk:read"
    #: ``adminPermissionSchema`` defines no ``risk:write``. Changing the limits
    #: is a platform configuration change, so ``settings:write`` grants it;
    #: ``risk:write`` is honoured as well should identity come to issue it.
    WRITE: Final = frozenset({"risk:write", "settings:write"})


ADMIN_ACTOR_KIND: Final = "ADMIN"

AUDIT_ACTION_LIMITS_CHANGED: Final = "risk_configuration_changed"
AUDIT_ENTITY_LIMITS: Final = "risk_limits"
AUDIT_SEVERITY_LIMITS: Final = "WARNING"

#: The window the overview counts stored decisions over.
DECISION_WINDOW_HOURS: Final = 24

#: The most matches one dashboard read returns.
DASHBOARD_MATCH_LIMIT: Final = 200
