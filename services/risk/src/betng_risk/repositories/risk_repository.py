"""PostgreSQL access: reads the whole pending book, writes only ``risk``."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator, Callable, Sequence
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any

import psycopg
from betng_service_kit import Pool
from psycopg import AsyncConnection
from psycopg.rows import DictRow
from psycopg.types.json import Jsonb

from ..constants import DASHBOARD_MATCH_LIMIT
from ..engine import OPEN_LIFECYCLES, Limits, SelectionState
from ..errors import DatabaseUnavailableError
from ..interfaces import BeforeLimitsCommit, RiskRepository
from ..types import (
    BookRows,
    BookTotals,
    DecisionRecord,
    DecisionTally,
    LimitsDraft,
    LimitsRecord,
    MarketBookRow,
    MarketRow,
    MarketTypeRow,
    MatchBookRow,
    MatchRow,
    SelectionBookRow,
    SelectionRow,
)

#: Closed for betting, not yet settled: the pending book still stands.
UNSETTLED_LIFECYCLES = (
    "BETTING_CLOSED",
    "SIMULATION_STARTED",
    "RESULT_GENERATED",
    "EVENTS_PUBLISHED",
    "MATCH_FINISHED",
    "SETTLEMENT_STARTED",
    "SIMULATION_FAILED",
    "SETTLEMENT_FAILED",
)

_SNAPSHOT = "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY"

#: Pending legs, one row per bet and selection, over every account and shop.
_PENDING_LEGS = """
    SELECT DISTINCT s.bet_id, s.match_id, s.market_id, s.selection_id,
           s.market_type::text AS market_type
    FROM betting.bet_selections s
    JOIN betting.bets b ON b.id = s.bet_id
    WHERE b.status::text = 'PENDING'
      AND (%(every)s OR s.match_id = ANY(%(match_ids)s::uuid[]))
"""

_SELECTION_BOOK = f"""
    WITH legs AS ({_PENDING_LEGS})
    SELECT l.match_id, l.market_id, l.selection_id,
           count(*)::bigint AS bets,
           count(DISTINCT b.user_id)::bigint AS customers,
           count(DISTINCT b.shop_id)::bigint AS shops,
           sum(b.stake)::bigint AS stake,
           sum(b.potential_payout)::bigint AS payout
    FROM legs l
    JOIN betting.bets b ON b.id = l.bet_id
    GROUP BY l.match_id, l.market_id, l.selection_id
"""

_MARKET_BOOK = f"""
    WITH legs AS ({_PENDING_LEGS}),
    per_bet AS (
        SELECT bet_id, match_id, market_id, min(market_type) AS market_type
        FROM legs
        GROUP BY bet_id, match_id, market_id
    )
    SELECT p.match_id, p.market_id, min(p.market_type) AS market_type,
           count(*)::bigint AS bets, sum(b.stake)::bigint AS stake
    FROM per_bet p
    JOIN betting.bets b ON b.id = p.bet_id
    GROUP BY p.match_id, p.market_id
"""

_MATCH_BOOK = f"""
    WITH legs AS ({_PENDING_LEGS}),
    per_bet AS (SELECT DISTINCT bet_id, match_id FROM legs)
    SELECT p.match_id, count(*)::bigint AS bets, sum(b.stake)::bigint AS stake
    FROM per_bet p
    JOIN betting.bets b ON b.id = p.bet_id
    GROUP BY p.match_id
"""

_LIMIT_COLUMNS = """
    version, min_stake, max_stake_per_bet, max_payout_per_bet,
    max_liability_per_selection, max_liability_per_market,
    max_liability_per_match, created_at, created_by, reason
"""


def _limits_record(row: DictRow) -> LimitsRecord:
    return LimitsRecord(
        limits=Limits(
            version=row["version"],
            min_stake=row["min_stake"],
            max_stake_per_bet=row["max_stake_per_bet"],
            max_payout_per_bet=row["max_payout_per_bet"],
            max_liability_per_selection=row["max_liability_per_selection"],
            max_liability_per_market=row["max_liability_per_market"],
            max_liability_per_match=row["max_liability_per_match"],
        ),
        created_at=row["created_at"],
        created_by=row["created_by"],
        reason=row["reason"],
    )


class PostgresRiskRepository(RiskRepository):
    """The repository over the shared ``betng`` database."""

    def __init__(self, pool: Pool, logger: logging.Logger) -> None:
        """Bind the repository to an opened pool."""
        self._pool = pool
        self._logger = logger

    @asynccontextmanager
    async def _connection(self) -> AsyncIterator[AsyncConnection[DictRow]]:
        """Yield a transaction; a database failure becomes a typed 503."""
        try:
            async with self._pool.connection() as connection:
                yield connection
        except psycopg.Error as error:
            self._logger.error(
                "Database operation failed", extra={"error": type(error).__name__}
            )
            raise DatabaseUnavailableError from error

    async def load_limits(self) -> LimitsRecord:
        """Return the limits version in force."""
        async with self._connection() as connection:
            return await self._read_limits(connection)

    async def _read_limits(self, connection: AsyncConnection[DictRow]) -> LimitsRecord:
        cursor = await connection.execute(
            f"SELECT {_LIMIT_COLUMNS} FROM risk.risk_limits WHERE active"
        )
        row = await cursor.fetchone()

        if row is None:
            raise DatabaseUnavailableError

        return _limits_record(row)

    async def replace_limits(
        self,
        draft: Callable[[LimitsRecord], LimitsDraft],
        *,
        created_by: str,
        reason: str,
        before_commit: BeforeLimitsCommit,
    ) -> LimitsRecord:
        """Insert the next limits version; a raising ``before_commit`` undoes it."""
        async with self._connection() as connection:
            await connection.execute(
                "SELECT pg_advisory_xact_lock(hashtext('risk:limits'))"
            )
            current = await self._read_limits(connection)
            amounts = draft(current)

            await connection.execute(
                "UPDATE risk.risk_limits SET active = false WHERE active"
            )
            cursor = await connection.execute(
                f"""
                INSERT INTO risk.risk_limits (
                    version, min_stake, max_stake_per_bet, max_payout_per_bet,
                    max_liability_per_selection, max_liability_per_market,
                    max_liability_per_match, active, created_by, reason
                )
                SELECT coalesce(max(version), 0) + 1, %s, %s, %s, %s, %s, %s,
                       true, %s, %s
                FROM risk.risk_limits
                RETURNING {_LIMIT_COLUMNS}
                """,
                (
                    amounts.min_stake,
                    amounts.max_stake_per_bet,
                    amounts.max_payout_per_bet,
                    amounts.max_liability_per_selection,
                    amounts.max_liability_per_market,
                    amounts.max_liability_per_match,
                    created_by,
                    reason,
                ),
            )
            row = await cursor.fetchone()
            if row is None:
                raise DatabaseUnavailableError

            created = _limits_record(row)
            await before_commit(current, created)

            return created

    async def load_selection_states(
        self, selection_ids: Sequence[str]
    ) -> dict[str, SelectionState]:
        """Return market and match state for each selection that exists."""
        async with self._connection() as connection:
            cursor = await connection.execute(
                """
                SELECT s.id AS selection_id, s.market_id, m.match_id,
                       m.status::text AS market_status,
                       mt.lifecycle::text AS match_lifecycle,
                       f.betting_closes_at,
                       (z.match_id IS NOT NULL) AS frozen
                FROM odds.market_selections s
                JOIN odds.markets m ON m.id = s.market_id
                LEFT JOIN match.matches mt ON mt.id = m.match_id
                LEFT JOIN match.fixtures f ON f.id = mt.fixture_id
                LEFT JOIN risk.exposure_freezes z ON z.match_id = m.match_id
                WHERE s.id = ANY(%s::uuid[])
                """,
                (list(selection_ids),),
            )
            rows = await cursor.fetchall()

        return {
            str(row["selection_id"]): SelectionState(
                selection_id=str(row["selection_id"]),
                market_id=str(row["market_id"]),
                match_id=str(row["match_id"]),
                market_status=row["market_status"],
                match_lifecycle=row["match_lifecycle"],
                betting_closes_at=row["betting_closes_at"],
                frozen=row["frozen"],
            )
            for row in rows
        }

    async def load_book(self, match_ids: Sequence[str] | None) -> BookRows:
        """Return the pending book at its three grains from one snapshot."""
        parameters = {
            "every": match_ids is None,
            "match_ids": list(match_ids or []),
        }

        async with self._connection() as connection:
            await connection.execute(_SNAPSHOT)
            selections = await (
                await connection.execute(_SELECTION_BOOK, parameters)
            ).fetchall()
            markets = await (
                await connection.execute(_MARKET_BOOK, parameters)
            ).fetchall()
            matches = await (
                await connection.execute(_MATCH_BOOK, parameters)
            ).fetchall()

        return BookRows(
            selections=tuple(
                SelectionBookRow(
                    match_id=str(row["match_id"]),
                    market_id=str(row["market_id"]),
                    selection_id=str(row["selection_id"]),
                    bets=row["bets"],
                    customers=row["customers"],
                    shops=row["shops"],
                    stake=row["stake"],
                    payout=row["payout"],
                )
                for row in selections
            ),
            markets=tuple(
                MarketBookRow(
                    match_id=str(row["match_id"]),
                    market_id=str(row["market_id"]),
                    market_type=row["market_type"],
                    bets=row["bets"],
                    stake=row["stake"],
                )
                for row in markets
            ),
            matches=tuple(
                MatchBookRow(
                    match_id=str(row["match_id"]),
                    bets=row["bets"],
                    stake=row["stake"],
                )
                for row in matches
            ),
        )

    async def load_book_totals(self) -> BookTotals:
        """Return the platform-wide pending totals."""
        async with self._connection() as connection:
            cursor = await connection.execute(
                """
                SELECT count(*)::bigint AS bets,
                       coalesce(sum(stake), 0)::bigint AS stake,
                       coalesce(sum(potential_payout), 0)::bigint AS payout
                FROM betting.bets
                WHERE status::text = 'PENDING'
                """
            )
            row = await cursor.fetchone()

        if row is None:
            raise DatabaseUnavailableError

        return BookTotals(bets=row["bets"], stake=row["stake"], payout=row["payout"])

    async def load_market_type_stakes(self) -> list[MarketTypeRow]:
        """Return pending stake grouped by market type."""
        async with self._connection() as connection:
            cursor = await connection.execute(
                r"""
                WITH legs AS (
                    SELECT s.bet_id, s.market_type::text AS market_type,
                           regexp_replace(s.market_label, '\s+[-+]?[0-9.]+$', '')
                               AS market_label
                    FROM betting.bet_selections s
                    JOIN betting.bets b ON b.id = s.bet_id
                    WHERE b.status::text = 'PENDING'
                ),
                labels AS (
                    SELECT market_type, min(market_label) AS market_label
                    FROM legs
                    GROUP BY market_type
                ),
                per_bet AS (SELECT DISTINCT bet_id, market_type FROM legs)
                SELECT p.market_type, l.market_label, sum(b.stake)::bigint AS stake
                FROM per_bet p
                JOIN betting.bets b ON b.id = p.bet_id
                JOIN labels l ON l.market_type = p.market_type
                GROUP BY p.market_type, l.market_label
                ORDER BY p.market_type
                """
            )
            rows = await cursor.fetchall()

        return [
            MarketTypeRow(
                market_type=row["market_type"],
                market_label=row["market_label"],
                stake=row["stake"],
            )
            for row in rows
        ]

    async def load_matches(self, match_ids: Sequence[str]) -> list[MatchRow]:
        """Return the matches that exist, ordered by kick-off."""
        async with self._connection() as connection:
            cursor = await connection.execute(
                """
                SELECT mt.id AS match_id, mt.lifecycle::text AS lifecycle,
                       f.kickoff_at, l.name AS league_name,
                       h.name || ' v ' || a.name AS match_label,
                       z.frozen_at
                FROM match.matches mt
                JOIN match.fixtures f ON f.id = mt.fixture_id
                JOIN match.leagues l ON l.id = f.league_id
                JOIN match.teams h ON h.id = f.home_team_id
                JOIN match.teams a ON a.id = f.away_team_id
                LEFT JOIN risk.exposure_freezes z ON z.match_id = mt.id
                WHERE mt.id = ANY(%s::uuid[])
                ORDER BY f.kickoff_at, mt.id
                """,
                (list(match_ids),),
            )
            rows = await cursor.fetchall()

        return [
            MatchRow(
                match_id=str(row["match_id"]),
                league_name=row["league_name"],
                match_label=row["match_label"],
                kickoff_at=row["kickoff_at"],
                lifecycle=row["lifecycle"],
                frozen_at=row["frozen_at"],
            )
            for row in rows
        ]

    async def load_dashboard_match_ids(self) -> list[str]:
        """Return open matches and closed, unsettled matches with pending bets."""
        async with self._connection() as connection:
            cursor = await connection.execute(
                """
                SELECT mt.id AS match_id
                FROM match.matches mt
                JOIN match.fixtures f ON f.id = mt.fixture_id
                WHERE mt.lifecycle::text = ANY(%(open)s)
                   OR (
                        mt.lifecycle::text = ANY(%(unsettled)s)
                        AND EXISTS (
                            SELECT 1
                            FROM betting.bet_selections s
                            JOIN betting.bets b ON b.id = s.bet_id
                            WHERE s.match_id = mt.id
                              AND b.status::text = 'PENDING'
                        )
                   )
                ORDER BY f.kickoff_at, mt.id
                LIMIT %(limit)s
                """,
                {
                    "open": sorted(OPEN_LIFECYCLES),
                    "unsettled": list(UNSETTLED_LIFECYCLES),
                    "limit": DASHBOARD_MATCH_LIMIT,
                },
            )
            rows = await cursor.fetchall()

        return [str(row["match_id"]) for row in rows]

    async def load_markets(self, market_ids: Sequence[str]) -> list[MarketRow]:
        """Return the markets that exist."""
        async with self._connection() as connection:
            cursor = await connection.execute(
                """
                SELECT id AS market_id, match_id, type::text AS type, line
                FROM odds.markets
                WHERE id = ANY(%s::uuid[])
                ORDER BY type::text, line NULLS FIRST, id
                """,
                (list(market_ids),),
            )
            rows = await cursor.fetchall()

        return [
            MarketRow(
                market_id=str(row["market_id"]),
                match_id=str(row["match_id"]),
                type=row["type"],
                line=row["line"],
            )
            for row in rows
        ]

    async def load_selections(self, market_ids: Sequence[str]) -> list[SelectionRow]:
        """Return every selection of the markets, in display order."""
        async with self._connection() as connection:
            cursor = await connection.execute(
                """
                SELECT id AS selection_id, market_id, code, label, odds
                FROM odds.market_selections
                WHERE market_id = ANY(%s::uuid[])
                ORDER BY sort_order, id
                """,
                (list(market_ids),),
            )
            rows = await cursor.fetchall()

        return [
            SelectionRow(
                selection_id=str(row["selection_id"]),
                market_id=str(row["market_id"]),
                code=row["code"],
                label=row["label"],
                odds=row["odds"],
            )
            for row in rows
        ]

    async def load_snapshots(self, match_ids: Sequence[str]) -> dict[str, Any]:
        """Return the frozen exposure snapshot of each frozen match."""
        async with self._connection() as connection:
            cursor = await connection.execute(
                """
                SELECT match_id, snapshot
                FROM risk.exposure_freezes
                WHERE match_id = ANY(%s::uuid[])
                """,
                (list(match_ids),),
            )
            rows = await cursor.fetchall()

        return {str(row["match_id"]): row["snapshot"] for row in rows}

    async def insert_decision(self, record: DecisionRecord) -> None:
        """Store one evaluation."""
        async with self._connection() as connection:
            await connection.execute(
                """
                INSERT INTO risk.risk_decisions (
                    id, request_id, actor_kind, actor_id, shop_id,
                    stake_requested, total_odds, decision, reason, max_stake,
                    legs, limits_version
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    record.id,
                    record.request_id,
                    record.actor_kind,
                    record.actor_id,
                    record.shop_id,
                    record.stake_requested,
                    record.total_odds,
                    record.decision,
                    record.reason,
                    record.max_stake,
                    Jsonb(record.legs),
                    record.limits_version,
                ),
            )

    async def insert_freeze(self, match_id: str, snapshot: dict[str, Any]) -> datetime:
        """Store the snapshot unless one exists; return the winning instant."""
        async with self._connection() as connection:
            await connection.execute(
                """
                INSERT INTO risk.exposure_freezes (match_id, snapshot)
                VALUES (%s, %s)
                ON CONFLICT (match_id) DO NOTHING
                """,
                (match_id, Jsonb(snapshot)),
            )
            cursor = await connection.execute(
                "SELECT frozen_at FROM risk.exposure_freezes WHERE match_id = %s",
                (match_id,),
            )
            row = await cursor.fetchone()

        if row is None:
            raise DatabaseUnavailableError

        frozen_at: datetime = row["frozen_at"]

        return frozen_at

    async def count_decisions(self, since: datetime) -> DecisionTally:
        """Count stored decisions by kind since an instant."""
        async with self._connection() as connection:
            cursor = await connection.execute(
                """
                SELECT count(*) FILTER (WHERE decision = 'ACCEPT')::bigint AS accepted,
                       count(*) FILTER (WHERE decision = 'LIMIT')::bigint AS limited,
                       count(*) FILTER (WHERE decision = 'REJECT')::bigint AS rejected
                FROM risk.risk_decisions
                WHERE created_at >= %s
                """,
                (since,),
            )
            row = await cursor.fetchone()

        if row is None:
            raise DatabaseUnavailableError

        return DecisionTally(
            accepted=row["accepted"], limited=row["limited"], rejected=row["rejected"]
        )
