from __future__ import annotations

from collections.abc import Sequence

import psycopg
from betng_service_kit import Pool
from psycopg_pool import PoolTimeout

from ..errors import DatabaseUnavailableError
from ..interfaces import MatchReadModel, MatchView


class PostgresMatchReadModel(MatchReadModel):
    def __init__(self, pool: Pool) -> None:
        self._pool = pool

    async def get_matches(self, match_ids: Sequence[str]) -> dict[str, MatchView]:
        """Return known matches by id; an unreadable schema raises, never guesses."""
        if not match_ids:
            return {}

        try:
            async with self._pool.connection() as connection:
                cursor = await connection.execute(
                    "SELECT m.id::text AS match_id, m.status::text AS status, "
                    "l.name AS league_name "
                    "FROM match.matches m "
                    "JOIN match.fixtures f ON f.id = m.fixture_id "
                    "JOIN match.leagues l ON l.id = f.league_id "
                    "WHERE m.id = ANY(%s::uuid[])",
                    (list(match_ids),),
                )
                rows = await cursor.fetchall()
        except (
            psycopg.OperationalError,
            psycopg.ProgrammingError,
            PoolTimeout,
        ) as error:
            # Includes a `match` schema that is not migrated yet.
            raise DatabaseUnavailableError from error

        return {
            row["match_id"]: MatchView(
                status=row["status"], league_name=row["league_name"]
            )
            for row in rows
        }
