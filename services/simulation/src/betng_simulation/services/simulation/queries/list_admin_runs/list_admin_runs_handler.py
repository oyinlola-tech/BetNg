"""List admin runs handler."""

from __future__ import annotations

from betng_service_kit import QueryHandler

from .....constants import SimulationQuery
from .....dtos import AdminSimulationRunList
from .....interfaces import MatchReadModel
from .....repositories import SimulationRepository
from .....utils import to_admin_run
from .list_admin_runs_query import ListAdminRunsQuery


class ListAdminRunsHandler(QueryHandler[ListAdminRunsQuery, AdminSimulationRunList]):
    """Lists runs for an admin, withholding every score not yet revealed."""

    message_type = SimulationQuery.LIST_ADMIN_RUNS

    def __init__(
        self, repository: SimulationRepository, match_read_model: MatchReadModel
    ) -> None:
        """Store the collaborators."""
        self._repository = repository
        self._match_read_model = match_read_model

    async def execute(self, message: ListAdminRunsQuery) -> AdminSimulationRunList:
        """Execute the message."""
        async with self._repository.transaction() as connection:
            records = await self._repository.list_admin_runs(
                connection, message.status, message.limit
            )

        matches = await self._match_read_model.get_matches(
            sorted({record.run.match_id for record in records})
        )

        return AdminSimulationRunList(
            items=[
                to_admin_run(record, matches.get(record.run.match_id))
                for record in records
            ]
        )
