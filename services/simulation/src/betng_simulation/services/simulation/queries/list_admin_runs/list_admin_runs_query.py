"""List admin runs query."""

from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import SimulationQuery
from .....dtos import AdminRunStatus, AdminSimulationRunList


@dataclass(frozen=True)
class ListAdminRunsQuery(Query[AdminSimulationRunList]):
    """Asks for runs, optionally by admin status."""

    status: AdminRunStatus | None
    limit: int

    type: str = SimulationQuery.LIST_ADMIN_RUNS
