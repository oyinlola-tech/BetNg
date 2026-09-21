from __future__ import annotations

import asyncio
import logging
import uuid

import psycopg
import pytest
from betng_service_kit import Pool

from betng_simulation.dtos import RunMatchRequest
from betng_simulation.engine import simulate
from betng_simulation.errors import DatabaseUnavailableError, SimulationFailedError
from betng_simulation.interfaces import Simulate
from betng_simulation.repositories import PostgresMatchReadModel, SimulationRepository
from betng_simulation.services.simulation.commands import (
    RunMatchCommand,
    RunMatchHandler,
)
from betng_simulation.utils import BackgroundAuditor

from .conftest import (
    FakeAuditRecorder,
    failing_simulate,
    new_match_id,
    run_match_payload,
)

LOGGER = logging.getLogger("simulation-tests")


def build_handler(
    repository: SimulationRepository,
    audit: FakeAuditRecorder,
    simulate_match: Simulate = simulate,
    seed_secret: str | None = None,
) -> tuple[RunMatchHandler, BackgroundAuditor]:
    auditor = BackgroundAuditor(audit, LOGGER)

    handler = RunMatchHandler(repository, simulate_match, seed_secret, auditor, LOGGER)

    return handler, auditor


def command(match_id: str) -> RunMatchCommand:
    return RunMatchCommand(RunMatchRequest.model_validate(run_match_payload(match_id)))


async def count(
    pool: Pool, table: str, match_id: str, status: str | None = None
) -> int:
    queries = {
        "runs": "SELECT count(*) AS n FROM simulation.simulation_runs "
        "WHERE match_id = %s AND (%s::text IS NULL OR status = %s)",
        "results": "SELECT count(*) AS n FROM simulation.match_results "
        "WHERE match_id = %s AND (%s::text IS NULL OR %s::text IS NULL)",
        "events": "SELECT count(*) AS n FROM simulation.match_events "
        "WHERE match_id = %s AND (%s::text IS NULL OR %s::text IS NULL)",
    }

    async with pool.connection() as connection:
        cursor = await connection.execute(queries[table], (match_id, status, status))
        row = await cursor.fetchone()

    assert row is not None
    return int(row["n"])


class TestRunMatch:
    async def test_a_match_is_simulated_once(
        self, pool: Pool, repository: SimulationRepository, audit: FakeAuditRecorder
    ) -> None:
        handler, auditor = build_handler(repository, audit)
        match_id = new_match_id()

        first = await handler.execute(command(match_id))
        second = await handler.execute(command(match_id))
        await auditor.drain()

        assert first.duplicate is False
        assert second.duplicate is True
        assert second.simulation_id == first.simulation_id
        assert second.result == first.result
        assert second.seed == first.seed
        assert second.event_count == first.event_count > 3
        assert await count(pool, "runs", match_id) == 1
        assert await count(pool, "runs", match_id, "COMPLETED") == 1
        assert await count(pool, "results", match_id) == 1
        assert await count(pool, "events", match_id) == first.event_count
        assert audit.actions() == ["simulation_started", "simulation_completed"]

    async def test_the_stored_result_is_the_engines(
        self, pool: Pool, repository: SimulationRepository, audit: FakeAuditRecorder
    ) -> None:
        handler, _ = build_handler(repository, audit)
        match_id = new_match_id()
        response = await handler.execute(command(match_id))

        async with repository.transaction() as connection:
            stored = await repository.get_active_configuration(connection)
            result = await repository.get_result(connection, match_id)
            events = await repository.list_events(connection, match_id)

        request = command(match_id).request
        expected = simulate(
            match_id,
            request.home.to_engine(),
            request.away.to_engine(),
            stored.configuration,
        )

        assert result is not None
        assert (result.home_goals, result.away_goals, result.winner) == (
            expected.result.home_goals,
            expected.result.away_goals,
            expected.result.winner,
        )
        assert result.winning_gap == abs(result.home_goals - result.away_goals)
        assert result.seed == expected.result.seed == response.seed
        assert (
            result.stats["home"]["possession"] + result.stats["away"]["possession"]
            == 100
        )
        assert [e.description for e in events] == [
            e.description for e in expected.events
        ]
        assert [e.sequence for e in events] == list(range(1, len(events) + 1))

    async def test_concurrent_callers_produce_one_run(
        self, pool: Pool, repository: SimulationRepository, audit: FakeAuditRecorder
    ) -> None:
        handler, _ = build_handler(repository, audit)
        match_id = new_match_id()

        responses = await asyncio.gather(
            *(handler.execute(command(match_id)) for _ in range(3))
        )

        assert sorted(response.duplicate for response in responses) == [
            False,
            True,
            True,
        ]
        assert len({response.simulation_id for response in responses}) == 1
        assert len({response.result for response in responses}) == 1
        assert await count(pool, "runs", match_id) == 1
        assert await count(pool, "runs", match_id, "COMPLETED") == 1
        assert await count(pool, "results", match_id) == 1

    async def test_a_failed_run_is_recorded_and_can_be_retried(
        self, pool: Pool, repository: SimulationRepository, audit: FakeAuditRecorder
    ) -> None:
        failing, failing_auditor = build_handler(repository, audit, failing_simulate)
        match_id = new_match_id()

        with pytest.raises(SimulationFailedError) as raised:
            await failing.execute(command(match_id))
        await failing_auditor.drain()

        assert raised.value.code == "SIMULATION_FAILED"
        assert raised.value.status_code == 502
        assert await count(pool, "runs", match_id, "FAILED") == 1
        assert await count(pool, "results", match_id) == 0
        assert await count(pool, "events", match_id) == 0
        assert audit.actions() == ["simulation_started", "simulation_failed"]

        async with repository.transaction() as connection:
            failed = await repository.get_latest_run(connection, match_id)
        assert failed is not None
        assert failed.attempt == 1
        assert failed.failure_reason == "ValueError: the engine was made to fail"

        working, _ = build_handler(repository, audit)
        retried = await working.execute(command(match_id))

        assert retried.duplicate is False
        assert await count(pool, "runs", match_id) == 2
        assert await count(pool, "results", match_id) == 1

        async with repository.transaction() as connection:
            live = await repository.get_live_run(connection, match_id)
        assert live is not None
        assert (live.status, live.attempt) == ("COMPLETED", 2)

    async def test_an_audit_outage_does_not_fail_a_simulation(
        self, repository: SimulationRepository, audit: FakeAuditRecorder
    ) -> None:
        audit.fail = True
        handler, auditor = build_handler(repository, audit)

        response = await handler.execute(command(new_match_id()))
        await auditor.drain()

        assert response.status == "COMPLETED"


class TestImmutability:
    @pytest.mark.parametrize(
        "statement",
        [
            "UPDATE simulation.match_results SET home_goals = 9 WHERE match_id = %s",
            "DELETE FROM simulation.match_results WHERE match_id = %s",
            "UPDATE simulation.match_events SET minute = 1 WHERE match_id = %s",
            "DELETE FROM simulation.match_events WHERE match_id = %s",
        ],
    )
    async def test_results_and_events_cannot_be_changed(
        self,
        pool: Pool,
        repository: SimulationRepository,
        audit: FakeAuditRecorder,
        statement: str,
    ) -> None:
        handler, _ = build_handler(repository, audit)
        match_id = new_match_id()
        before = await handler.execute(command(match_id))

        with pytest.raises(psycopg.errors.RestrictViolation):
            async with pool.connection() as connection:
                await connection.execute(statement, (match_id,))

        after = await handler.execute(command(match_id))
        assert after.result == before.result
        assert after.event_count == before.event_count

    async def test_a_result_cannot_contradict_its_score(
        self, pool: Pool, repository: SimulationRepository, audit: FakeAuditRecorder
    ) -> None:
        handler, _ = build_handler(repository, audit)
        response = await handler.execute(command(new_match_id()))

        with pytest.raises(psycopg.errors.CheckViolation):
            async with pool.connection() as connection:
                await connection.execute(
                    "INSERT INTO simulation.match_results (match_id, simulation_id, "
                    "home_goals, away_goals, winner, winning_gap, home_xg, away_xg, "
                    "seed, model_version, configuration_version, stats) "
                    "VALUES (%s, %s, 0, 3, 'HOME', 3, 1, 1, 'x', 'poisson-1.0', 1, "
                    "'{}')",
                    (str(uuid.uuid4()), str(response.simulation_id)),
                )

    async def test_a_stored_configuration_cannot_be_edited(self, pool: Pool) -> None:
        with pytest.raises(psycopg.errors.RestrictViolation):
            async with pool.connection() as connection:
                await connection.execute(
                    "UPDATE simulation.model_configurations "
                    "SET params = '{}'::jsonb WHERE version = 1"
                )

        with pytest.raises(psycopg.errors.RestrictViolation):
            async with pool.connection() as connection:
                await connection.execute(
                    "DELETE FROM simulation.model_configurations WHERE version = 1"
                )


class TestSchemaIsolation:
    async def test_the_login_cannot_write_another_schema(self, pool: Pool) -> None:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            async with pool.connection() as connection:
                await connection.execute(
                    "CREATE TABLE betting.simulation_probe (id int)"
                )


class TestMatchReadModel:
    async def test_it_fails_closed_or_finds_nothing_for_an_unknown_match(
        self, pool: Pool
    ) -> None:
        async with pool.connection() as connection:
            cursor = await connection.execute(
                "SELECT to_regclass('match.matches') IS NOT NULL AS present"
            )
            row = await cursor.fetchone()

        assert row is not None
        read_model = PostgresMatchReadModel(pool)

        if row["present"]:
            assert await read_model.get_matches([new_match_id()]) == {}
        else:
            with pytest.raises(DatabaseUnavailableError):
                await read_model.get_matches([new_match_id()])
