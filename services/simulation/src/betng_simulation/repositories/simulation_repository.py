"""Data access for the ``simulation`` schema."""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import psycopg
from betng_service_kit import Pool
from psycopg import AsyncConnection
from psycopg.rows import DictRow
from psycopg.types.json import Jsonb
from psycopg_pool import PoolTimeout

from ..engine import (
    MatchEventDraft,
    MatchStats,
    ModelConfiguration,
    SideStats,
    SimulationOutput,
    SimulationTeam,
)
from ..errors import DatabaseUnavailableError
from ..interfaces import (
    AdminRunRecord,
    EventRecord,
    ResultRecord,
    RunRecord,
    StoredConfiguration,
)
from ..utils import build_configuration, parameters_to_json

Connection = AsyncConnection[DictRow]

CONFIGURATION_LOCK_KEY = "simulation:model_configurations"
SYSTEM_AUTHOR = "system"
DEFAULT_CONFIGURATION_REASON = "Initial model parameters."

_RUN_COLUMNS = (
    "id::text AS id, match_id::text AS match_id, status, model_version, "
    "configuration_version, seed, attempt, started_at, completed_at, "
    "failure_reason, home_team_name, away_team_name, retry_requested_at"
)

# SQL text is built from these constants only; input is always a bound parameter.
# The admin contract has no CANCELLED, so a cancelled run reads as FAILED.
_ADMIN_STATUS = """
    CASE
        WHEN r.status = 'FAILED'
            AND r.retry_requested_at IS NOT NULL
            AND NOT EXISTS (
                SELECT 1 FROM simulation.simulation_runs later
                WHERE later.match_id = r.match_id AND later.attempt > r.attempt
            )
        THEN 'QUEUED'
        WHEN r.status = 'CANCELLED' THEN 'FAILED'
        ELSE r.status
    END
"""

_ADMIN_RUN_QUERY = f"""
    SELECT * FROM (
        SELECT
            r.id::text AS id, r.match_id::text AS match_id, r.status,
            r.model_version, r.configuration_version, r.seed, r.attempt,
            r.started_at, r.completed_at, r.failure_reason, r.home_team_name,
            r.away_team_name, r.retry_requested_at,
            {_ADMIN_STATUS} AS admin_status,
            (
                SELECT count(*) FROM simulation.match_events e
                WHERE e.simulation_id = r.id
            ) AS event_count,
            mr.home_goals, mr.away_goals
        FROM simulation.simulation_runs r
        LEFT JOIN simulation.match_results mr ON mr.simulation_id = r.id
    ) runs
"""


def _to_run(row: DictRow) -> RunRecord:
    return RunRecord(
        id=row["id"],
        match_id=row["match_id"],
        status=row["status"],
        model_version=row["model_version"],
        configuration_version=row["configuration_version"],
        seed=row["seed"],
        attempt=row["attempt"],
        started_at=row["started_at"],
        completed_at=row["completed_at"],
        failure_reason=row["failure_reason"],
        home_team_name=row["home_team_name"],
        away_team_name=row["away_team_name"],
        retry_requested_at=row["retry_requested_at"],
    )


def _to_admin_run(row: DictRow) -> AdminRunRecord:
    return AdminRunRecord(
        run=_to_run(row),
        admin_status=row["admin_status"],
        event_count=row["event_count"],
        home_goals=row["home_goals"],
        away_goals=row["away_goals"],
    )


def _to_stored_configuration(row: DictRow) -> StoredConfiguration:
    return StoredConfiguration(
        configuration=build_configuration(
            row["version"], row["model_version"], row["params"]
        ),
        active=row["active"],
        created_at=row["created_at"],
        created_by=row["created_by"],
        reason=row["reason"],
    )


def _side_stats_json(stats: SideStats) -> dict[str, int]:
    return {
        "possession": stats.possession,
        "shots": stats.shots,
        "shotsOnTarget": stats.shots_on_target,
        "corners": stats.corners,
        "fouls": stats.fouls,
        "offsides": stats.offsides,
        "yellowCards": stats.yellow_cards,
        "redCards": stats.red_cards,
    }


def stats_to_json(match_id: str, stats: MatchStats) -> dict[str, Any]:
    """Return the ``matchStatsSchema`` JSON shape."""
    return {
        "matchId": match_id,
        "asOfMinute": stats.as_of_minute,
        "home": _side_stats_json(stats.home),
        "away": _side_stats_json(stats.away),
    }


class SimulationRepository:
    """Data access for the ``simulation`` schema; values are always bound."""

    def __init__(self, pool: Pool) -> None:
        """Store the collaborators."""
        self._pool = pool

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[Connection]:
        """One connection, committed on exit and rolled back on an error."""
        try:
            async with self._pool.connection() as connection:
                yield connection
        except (psycopg.OperationalError, PoolTimeout) as error:
            raise DatabaseUnavailableError from error

    async def ensure_default_configuration(self, defaults: ModelConfiguration) -> None:
        """Store the engine's defaults as the first version of an empty table."""
        async with self.transaction() as connection:
            await connection.execute(
                "SELECT pg_advisory_xact_lock(hashtext(%s))",
                (CONFIGURATION_LOCK_KEY,),
            )
            await connection.execute(
                "INSERT INTO simulation.model_configurations "
                "(version, model_version, params, active, created_by, reason) "
                "SELECT %s::integer, %s::text, %s::jsonb, true, %s::text, %s::text "
                "WHERE NOT EXISTS "
                "(SELECT 1 FROM simulation.model_configurations)",
                (
                    defaults.version,
                    defaults.model_version,
                    Jsonb(parameters_to_json(defaults)),
                    SYSTEM_AUTHOR,
                    DEFAULT_CONFIGURATION_REASON,
                ),
            )

    async def get_active_configuration(
        self, connection: Connection
    ) -> StoredConfiguration:
        """Return the active configuration."""
        cursor = await connection.execute(
            "SELECT version, model_version, params, active, created_at, "
            "created_by, reason FROM simulation.model_configurations WHERE active"
        )
        row = await cursor.fetchone()

        if row is None:
            raise RuntimeError("No model configuration is active.")

        return _to_stored_configuration(row)

    async def lock_configurations(self, connection: Connection) -> None:
        """Serialise configuration changes for the rest of the transaction."""
        await connection.execute(
            "SELECT pg_advisory_xact_lock(hashtext(%s))", (CONFIGURATION_LOCK_KEY,)
        )

    async def next_configuration_version(self, connection: Connection) -> int:
        """Return the next version number; call under the lock."""
        cursor = await connection.execute(
            "SELECT COALESCE(MAX(version), 0) + 1 AS version "
            "FROM simulation.model_configurations"
        )
        row = await cursor.fetchone()
        assert row is not None

        return int(row["version"])

    async def activate_new_configuration(
        self,
        connection: Connection,
        configuration: ModelConfiguration,
        created_by: str,
        reason: str,
    ) -> StoredConfiguration:
        """Insert a new version and make it the active one."""
        await connection.execute(
            "UPDATE simulation.model_configurations SET active = false WHERE active"
        )
        cursor = await connection.execute(
            "INSERT INTO simulation.model_configurations "
            "(version, model_version, params, active, created_by, reason) "
            "VALUES (%s, %s, %s, true, %s, %s) "
            "RETURNING version, model_version, params, active, created_at, "
            "created_by, reason",
            (
                configuration.version,
                configuration.model_version,
                Jsonb(parameters_to_json(configuration)),
                created_by,
                reason,
            ),
        )
        row = await cursor.fetchone()
        assert row is not None

        return _to_stored_configuration(row)

    async def claim_run(
        self,
        connection: Connection,
        run_id: str,
        match_id: str,
        configuration: ModelConfiguration,
        seed: str,
        home: SimulationTeam,
        away: SimulationTeam,
    ) -> bool:
        """Insert the RUNNING row that locks the match; False if a live run exists."""
        cursor = await connection.execute(
            "INSERT INTO simulation.simulation_runs "
            "(id, match_id, status, model_version, configuration_version, seed, "
            "attempt, home_team_id, home_team_name, away_team_id, away_team_name) "
            "SELECT %(id)s::uuid, %(match_id)s::uuid, 'RUNNING', "
            "%(model_version)s::text, %(configuration_version)s::integer, "
            "%(seed)s::text, COALESCE(MAX(attempt), 0) + 1, %(home_id)s::uuid, "
            "%(home_name)s::text, %(away_id)s::uuid, %(away_name)s::text "
            "FROM simulation.simulation_runs WHERE match_id = %(match_id)s::uuid "
            "ON CONFLICT (match_id) WHERE status IN ('RUNNING', 'COMPLETED') "
            "DO NOTHING RETURNING id",
            {
                "id": run_id,
                "match_id": match_id,
                "model_version": configuration.model_version,
                "configuration_version": configuration.version,
                "seed": seed,
                "home_id": home.team_id,
                "home_name": home.name,
                "away_id": away.team_id,
                "away_name": away.name,
            },
        )

        return await cursor.fetchone() is not None

    async def store_output(
        self, connection: Connection, run_id: str, output: SimulationOutput
    ) -> None:
        """Insert the result and events and complete the run."""
        result = output.result

        await connection.execute(
            "INSERT INTO simulation.match_results "
            "(match_id, simulation_id, home_goals, away_goals, winner, "
            "winning_gap, home_xg, away_xg, seed, model_version, "
            "configuration_version, stats) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
            (
                result.match_id,
                run_id,
                result.home_goals,
                result.away_goals,
                result.winner,
                result.winning_gap,
                round(output.probabilities.home_xg, 4),
                round(output.probabilities.away_xg, 4),
                result.seed,
                result.model_version,
                result.configuration_version,
                Jsonb(stats_to_json(result.match_id, output.stats)),
            ),
        )

        async with connection.cursor() as cursor:
            await cursor.executemany(
                "INSERT INTO simulation.match_events "
                "(id, match_id, simulation_id, sequence, minute, type, side, "
                "player, secondary_player, score_home, score_away, description) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                [
                    self._event_parameters(result.match_id, run_id, event)
                    for event in output.events
                ],
            )

        await connection.execute(
            "UPDATE simulation.simulation_runs "
            "SET status = 'COMPLETED', completed_at = now() "
            "WHERE id = %s AND status = 'RUNNING'",
            (run_id,),
        )

    @staticmethod
    def _event_parameters(
        match_id: str, run_id: str, event: MatchEventDraft
    ) -> tuple[Any, ...]:
        # Deterministic, so a replay of the match yields the same event ids.
        event_id = uuid.uuid5(uuid.UUID(match_id), f"event:{event.sequence}")

        return (
            str(event_id),
            match_id,
            run_id,
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

    async def record_failed_run(
        self,
        connection: Connection,
        run_id: str,
        match_id: str,
        configuration: ModelConfiguration,
        seed: str,
        home: SimulationTeam,
        away: SimulationTeam,
        failure_reason: str,
    ) -> None:
        """Insert a FAILED run; it never holds the match lock."""
        await connection.execute(
            "INSERT INTO simulation.simulation_runs "
            "(id, match_id, status, model_version, configuration_version, seed, "
            "attempt, completed_at, failure_reason, home_team_id, home_team_name, "
            "away_team_id, away_team_name) "
            "SELECT %(id)s::uuid, %(match_id)s::uuid, 'FAILED', "
            "%(model_version)s::text, %(configuration_version)s::integer, "
            "%(seed)s::text, COALESCE(MAX(attempt), 0) + 1, now(), "
            "%(failure_reason)s::text, %(home_id)s::uuid, %(home_name)s::text, "
            "%(away_id)s::uuid, %(away_name)s::text "
            "FROM simulation.simulation_runs WHERE match_id = %(match_id)s::uuid",
            {
                "id": run_id,
                "match_id": match_id,
                "model_version": configuration.model_version,
                "configuration_version": configuration.version,
                "seed": seed,
                "failure_reason": failure_reason,
                "home_id": home.team_id,
                "home_name": home.name,
                "away_id": away.team_id,
                "away_name": away.name,
            },
        )

    async def get_live_run(
        self, connection: Connection, match_id: str
    ) -> RunRecord | None:
        """Return the RUNNING or COMPLETED run of a match."""
        cursor = await connection.execute(
            f"SELECT {_RUN_COLUMNS} FROM simulation.simulation_runs "
            "WHERE match_id = %s AND status IN ('RUNNING', 'COMPLETED')",
            (match_id,),
        )
        row = await cursor.fetchone()

        return None if row is None else _to_run(row)

    async def get_latest_run(
        self, connection: Connection, match_id: str
    ) -> RunRecord | None:
        """Return the live run when there is one, otherwise the latest attempt."""
        cursor = await connection.execute(
            f"SELECT {_RUN_COLUMNS} FROM simulation.simulation_runs "
            "WHERE match_id = %s "
            "ORDER BY (status IN ('RUNNING', 'COMPLETED')) DESC, attempt DESC, "
            "started_at DESC LIMIT 1",
            (match_id,),
        )
        row = await cursor.fetchone()

        return None if row is None else _to_run(row)

    async def lock_run(self, connection: Connection, run_id: str) -> RunRecord | None:
        """Return a run, locked for update."""
        cursor = await connection.execute(
            f"SELECT {_RUN_COLUMNS} FROM simulation.simulation_runs "
            "WHERE id = %s FOR UPDATE",
            (run_id,),
        )
        row = await cursor.fetchone()

        return None if row is None else _to_run(row)

    async def get_result(
        self, connection: Connection, match_id: str
    ) -> ResultRecord | None:
        """Return the stored result of a match."""
        cursor = await connection.execute(
            "SELECT match_id::text AS match_id, simulation_id::text AS simulation_id, "
            "home_goals, away_goals, winner, winning_gap, home_xg, away_xg, seed, "
            "model_version, configuration_version, stats, created_at "
            "FROM simulation.match_results WHERE match_id = %s",
            (match_id,),
        )
        row = await cursor.fetchone()

        if row is None:
            return None

        return ResultRecord(
            match_id=row["match_id"],
            simulation_id=row["simulation_id"],
            home_goals=row["home_goals"],
            away_goals=row["away_goals"],
            winner=row["winner"],
            winning_gap=row["winning_gap"],
            home_xg=float(row["home_xg"]),
            away_xg=float(row["away_xg"]),
            seed=row["seed"],
            model_version=row["model_version"],
            configuration_version=row["configuration_version"],
            stats=dict(row["stats"]),
            created_at=row["created_at"],
        )

    async def count_events(self, connection: Connection, match_id: str) -> int:
        """Count a match's stored events."""
        cursor = await connection.execute(
            "SELECT count(*) AS total FROM simulation.match_events WHERE match_id = %s",
            (match_id,),
        )
        row = await cursor.fetchone()
        assert row is not None

        return int(row["total"])

    async def list_events(
        self, connection: Connection, match_id: str
    ) -> list[EventRecord]:
        """Return a match's events in sequence order."""
        cursor = await connection.execute(
            "SELECT id::text AS id, match_id::text AS match_id, sequence, minute, "
            "type, side, player, secondary_player, score_home, score_away, "
            "description FROM simulation.match_events "
            "WHERE match_id = %s ORDER BY sequence",
            (match_id,),
        )

        return [EventRecord(**row) for row in await cursor.fetchall()]

    async def list_admin_runs(
        self, connection: Connection, status: str | None, limit: int
    ) -> list[AdminRunRecord]:
        """Return runs, newest first, filtered by admin status."""
        cursor = await connection.execute(
            _ADMIN_RUN_QUERY
            + "WHERE (%(status)s::text IS NULL OR admin_status = %(status)s) "
            "ORDER BY started_at DESC, id LIMIT %(limit)s",
            {"status": status, "limit": limit},
        )

        return [_to_admin_run(row) for row in await cursor.fetchall()]

    async def get_admin_run(
        self, connection: Connection, run_id: str
    ) -> AdminRunRecord | None:
        """Return one run in its admin projection."""
        cursor = await connection.execute(
            _ADMIN_RUN_QUERY + "WHERE id = %(id)s", {"id": run_id}
        )
        row = await cursor.fetchone()

        return None if row is None else _to_admin_run(row)

    async def request_retry(
        self, connection: Connection, run_id: str, requested_by: str, reason: str
    ) -> bool:
        """Flag a FAILED run for retry; false when it no longer qualifies."""
        cursor = await connection.execute(
            "UPDATE simulation.simulation_runs "
            "SET retry_requested_at = now(), retry_requested_by = %s, "
            "operator_reason = %s "
            "WHERE id = %s AND status = 'FAILED' AND retry_requested_at IS NULL",
            (requested_by, reason, run_id),
        )

        return cursor.rowcount == 1

    async def cancel_run(
        self, connection: Connection, run_id: str, reason: str
    ) -> bool:
        """Cancel a FAILED run; false when it no longer qualifies."""
        cursor = await connection.execute(
            "UPDATE simulation.simulation_runs "
            "SET status = 'CANCELLED', retry_requested_at = NULL, "
            "retry_requested_by = NULL, operator_reason = %s "
            "WHERE id = %s AND status = 'FAILED'",
            (reason, run_id),
        )

        return cursor.rowcount == 1
