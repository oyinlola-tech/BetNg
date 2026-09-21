from __future__ import annotations

from betng_service_kit import QueryHandler

from .....constants import SimulationQuery
from .....dtos import MatchResultView, MatchRunDetail, SimulationRunView
from .....errors import MatchNotSimulatedError
from .....repositories import SimulationRepository
from .get_match_run_query import GetMatchRunQuery


class GetMatchRunHandler(QueryHandler[GetMatchRunQuery, MatchRunDetail]):
    message_type = SimulationQuery.GET_MATCH_RUN

    def __init__(self, repository: SimulationRepository) -> None:
        self._repository = repository

    async def execute(self, message: GetMatchRunQuery) -> MatchRunDetail:
        async with self._repository.transaction() as connection:
            run = await self._repository.get_latest_run(connection, message.match_id)

            if run is None:
                raise MatchNotSimulatedError

            result = await self._repository.get_result(connection, message.match_id)

        return MatchRunDetail(
            run=SimulationRunView.model_validate(
                {
                    "id": run.id,
                    "match_id": run.match_id,
                    "status": run.status,
                    "model_version": run.model_version,
                    "configuration_version": run.configuration_version,
                    "seed": run.seed,
                    "attempt": run.attempt,
                    "started_at": run.started_at,
                    "completed_at": run.completed_at,
                    "failure_reason": run.failure_reason,
                }
            ),
            result=(
                None
                if result is None
                else MatchResultView.model_validate(
                    {
                        "match_id": result.match_id,
                        "simulation_id": result.simulation_id,
                        "home_goals": result.home_goals,
                        "away_goals": result.away_goals,
                        "winner": result.winner,
                        "winning_gap": result.winning_gap,
                        "home_xg": result.home_xg,
                        "away_xg": result.away_xg,
                        "seed": result.seed,
                        "model_version": result.model_version,
                        "configuration_version": result.configuration_version,
                        "stats": result.stats,
                        "created_at": result.created_at,
                    }
                )
            ),
        )
