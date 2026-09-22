from __future__ import annotations

import asyncio
import hmac
from typing import Any

from betng_service_kit import QueryHandler

from .....constants import SimulationQuery
from .....dtos import ReplayMatchResponse
from .....dtos.simulation_dto import ReplayMismatch
from .....engine import (
    MatchEventDraft,
    SimulationOutput,
    UnknownModelVersionError,
    derive_seed,
    simulate_with_seed,
)
from .....errors import MatchNotSimulatedError
from .....interfaces import EventRecord, ResultRecord
from .....repositories import SimulationRepository
from .....repositories.simulation_repository import stats_to_json
from .replay_match_query import ReplayMatchQuery

COMPLETED = "COMPLETED"
XG_PLACES = 4


def _event_tuple(event: MatchEventDraft | EventRecord) -> tuple[Any, ...]:
    return (
        event.sequence,
        event.minute,
        event.type,
        event.side,
        event.player,
        event.secondary_player,
        event.score_home,
        event.score_away,
        event.description,
    )


def _mismatches(
    output: SimulationOutput,
    result: ResultRecord,
    events: list[EventRecord],
) -> list[ReplayMismatch]:
    replayed = output.result
    found: list[ReplayMismatch] = []

    if (
        replayed.home_goals,
        replayed.away_goals,
        replayed.winner,
        replayed.winning_gap,
    ) != (result.home_goals, result.away_goals, result.winner, result.winning_gap):
        found.append("result")
    if [_event_tuple(event) for event in output.events] != [
        _event_tuple(event) for event in events
    ]:
        found.append("events")
    if stats_to_json(result.match_id, output.stats) != result.stats:
        found.append("stats")
    if (round(output.home_xg, XG_PLACES), round(output.away_xg, XG_PLACES)) != (
        result.home_xg,
        result.away_xg,
    ):
        found.append("xg")

    return found


class ReplayMatchHandler(QueryHandler[ReplayMatchQuery, ReplayMatchResponse]):
    """Re-derives a stored run from its seed and versions and compares it."""

    message_type = SimulationQuery.REPLAY_MATCH

    def __init__(
        self, repository: SimulationRepository, seed_secret: str | None
    ) -> None:
        self._repository = repository
        # Only compared against, never returned or logged.
        self._seed_secret = seed_secret

    async def execute(self, message: ReplayMatchQuery) -> ReplayMatchResponse:
        match_id = message.match_id

        async with self._repository.transaction() as connection:
            run = await self._repository.get_live_run(connection, match_id)
            if run is None or run.status != COMPLETED:
                raise MatchNotSimulatedError

            result = await self._repository.get_result(connection, match_id)
            events = await self._repository.list_events(connection, match_id)
            inputs = await self._repository.get_run_inputs(connection, run.id)
            stored = await self._repository.get_configuration(
                connection, run.configuration_version
            )

        if result is None:
            raise MatchNotSimulatedError

        seed_verified = (
            None
            if self._seed_secret is None
            else hmac.compare_digest(
                derive_seed(
                    match_id,
                    run.model_version,
                    run.configuration_version,
                    self._seed_secret,
                ),
                run.seed,
            )
        )
        base = {
            "match_id": match_id,
            "simulation_id": run.id,
            "model_version": run.model_version,
            "configuration_version": run.configuration_version,
            "seed_verified": seed_verified,
            "event_count": len(events),
        }

        if inputs is None or stored is None:
            return ReplayMatchResponse.model_validate(
                {
                    **base,
                    "replayable": False,
                    "identical": None,
                    "mismatches": [],
                    "reason": "The run predates recorded inputs.",
                }
            )

        configuration = stored.configuration
        if configuration.model_version != run.model_version:
            return ReplayMatchResponse.model_validate(
                {
                    **base,
                    "replayable": False,
                    "identical": None,
                    "mismatches": [],
                    "reason": "The run's configuration names a different model.",
                }
            )

        home, away = inputs
        try:
            output = await asyncio.to_thread(
                simulate_with_seed, match_id, home, away, configuration, run.seed
            )
        except UnknownModelVersionError:
            return ReplayMatchResponse.model_validate(
                {
                    **base,
                    "replayable": False,
                    "identical": None,
                    "mismatches": [],
                    "reason": "This build cannot run the run's model version.",
                }
            )

        mismatches = _mismatches(output, result, events)
        if seed_verified is False:
            mismatches.append("seed")

        return ReplayMatchResponse.model_validate(
            {
                **base,
                "replayable": True,
                "identical": not mismatches,
                "mismatches": mismatches,
            }
        )
