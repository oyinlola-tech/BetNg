from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from betng_service_kit import Pool
from psycopg import AsyncConnection, OperationalError
from psycopg.rows import DictRow
from psycopg_pool import PoolTimeout

from ..errors import DatabaseUnavailableError


@asynccontextmanager
async def transaction(pool: Pool) -> AsyncIterator[AsyncConnection[DictRow]]:
    """Yield a connection whose work commits on a clean exit, else rolls back."""
    try:
        async with pool.connection() as connection:
            yield connection
    except (OperationalError, PoolTimeout) as error:
        raise DatabaseUnavailableError from error
