from __future__ import annotations

from typing import Final


class SimulationCommand:
    RUN_MATCH: Final = "simulation.runMatch"
    APPLY_RUN_ACTION: Final = "simulation.applyRunAction"
    UPDATE_CONFIGURATION: Final = "simulation.updateConfiguration"


class SimulationQuery:
    CALCULATE_PROBABILITIES: Final = "simulation.calculateProbabilities"
    GET_MATCH_RUN: Final = "simulation.getMatchRun"
    LIST_MATCH_EVENTS: Final = "simulation.listMatchEvents"
    LIST_ADMIN_RUNS: Final = "simulation.listAdminRuns"
    GET_CONFIGURATION: Final = "simulation.getConfiguration"
    GET_SQUADS: Final = "simulation.getSquads"


class SimulationPermission:
    """Admin permissions this service checks."""

    READ: Final = "simulation:read"
    OPERATE: Final = "simulation:operate"


class SimulationAuditAction:
    """Audit actions (architecture §9, plus the two run actions)."""

    STARTED: Final = "simulation_started"
    COMPLETED: Final = "simulation_completed"
    FAILED: Final = "simulation_failed"
    CONFIGURATION_CHANGED: Final = "simulation_configuration_changed"
    RETRY_REQUESTED: Final = "simulation_retry_requested"
    CANCELLED: Final = "simulation_cancelled"


class AuditEntity:
    """Audit entity types."""

    SIMULATION: Final = "simulation"
    CONFIGURATION: Final = "simulation_configuration"


ADMIN_ACTOR_KIND: Final = "ADMIN"

ADMIN_RUNS_DEFAULT_LIMIT: Final = 100
ADMIN_RUNS_MAX_LIMIT: Final = 200
