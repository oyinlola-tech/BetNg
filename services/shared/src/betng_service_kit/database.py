from __future__ import annotations

import hashlib
import logging
from pathlib import Path

from psycopg import AsyncConnection
from psycopg.rows import DictRow, dict_row
from psycopg_pool import AsyncConnectionPool

from .health import DependencyProbe

Pool = AsyncConnectionPool[AsyncConnection[DictRow]]


def create_pool(database_url: str, *, max_size: int = 10) -> Pool:
    return AsyncConnectionPool(
        conninfo=database_url,
        min_size=1,
        max_size=max_size,
        open=False,
        connection_class=AsyncConnection[DictRow],
        kwargs={"row_factory": dict_row, "autocommit": False},
    )


def database_probe(pool: Pool) -> DependencyProbe:
    async def check() -> None:
        async with pool.connection(timeout=2) as connection:
            await connection.execute("SELECT 1")

    return DependencyProbe(name="postgres", check=check)


async def apply_migrations(
    pool: Pool, schema: str, directory: Path, logger: logging.Logger
) -> list[str]:
    """Apply new ``*.sql`` files in name order; refuse one that changed after it ran."""
    applied: list[str] = []

    async with pool.connection() as connection:
        await connection.execute(
            f"CREATE TABLE IF NOT EXISTS {schema}.schema_migrations ("
            "name text PRIMARY KEY, checksum text NOT NULL, "
            "applied_at timestamptz NOT NULL DEFAULT now())"
        )
        await connection.execute(
            "SELECT pg_advisory_xact_lock(hashtext(%s))", (f"migrate:{schema}",)
        )
        cursor = await connection.execute(
            f"SELECT name, checksum FROM {schema}.schema_migrations"
        )
        known = {row["name"]: row["checksum"] for row in await cursor.fetchall()}

        for path in sorted(directory.glob("*.sql")):
            sql = path.read_text(encoding="utf-8")
            checksum = hashlib.sha256(sql.encode("utf-8")).hexdigest()

            if path.name in known:
                if known[path.name] != checksum:
                    raise RuntimeError(
                        f"Migration {path.name} changed after it was applied."
                    )
                continue

            await connection.execute(sql.encode("utf-8"))
            await connection.execute(
                f"INSERT INTO {schema}.schema_migrations (name, checksum) "
                "VALUES (%s, %s)",
                (path.name, checksum),
            )
            applied.append(path.name)

        await connection.commit()

    if applied:
        logger.info("Migrations applied", extra={"migrations": applied})

    return applied
