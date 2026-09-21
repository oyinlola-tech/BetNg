from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any
from uuid import uuid4

from betng_service_kit import Pool
from psycopg import AsyncConnection
from psycopg.rows import DictRow
from psycopg.types.json import Jsonb

from ..constants import MarketStatusValue, SnapshotReasonValue
from ..interfaces import (
    ConfigurationCommitGuard,
    MarketCommitGuard,
    OddsRepository,
    StatusDecision,
)
from ..pricing import PricedMarket, PricingConfiguration
from ..types import (
    ConfigurationRecord,
    MarketRecord,
    PublishOutcome,
    SelectionRecord,
    SnapshotRecord,
)
from ..utils import transaction

Connection = AsyncConnection[DictRow]

_MARKET_COLUMNS = (
    "id, match_id, type, line, status, odds_version, created_at, updated_at"
)
_SELECTION_COLUMNS = (
    "id, market_id, match_id, code, label, probability, odds, sort_order"
)
_CONFIGURATION_COLUMNS = (
    "version, margins, min_odds, max_odds, active, created_at, created_by, reason"
)

#: Built in SQL from the rows just written, so it cannot disagree with them.
_SNAPSHOT_SQL = """
    INSERT INTO odds.odds_snapshots
        (id, market_id, match_id, odds_version, reason, status, prices)
    SELECT gen_random_uuid(), m.id, m.match_id, m.odds_version, %s, m.status,
           (SELECT jsonb_agg(
                       jsonb_build_object(
                           'selectionId', s.id, 'code', s.code,
                           'odds', s.odds, 'probability', s.probability)
                       ORDER BY s.sort_order)
              FROM odds.market_selections s
             WHERE s.market_id = m.id)
      FROM odds.markets m
     WHERE m.id = ANY(%s::uuid[])
"""

_TRADING_STATUSES = [
    MarketStatusValue.OPEN,
    MarketStatusValue.SUSPENDED,
    MarketStatusValue.CLOSED,
]


def _configuration(row: dict[str, Any]) -> ConfigurationRecord:
    return ConfigurationRecord(
        pricing=PricingConfiguration(
            version=row["version"],
            margins={
                name: Decimal(str(value)) for name, value in row["margins"].items()
            },
            min_odds=row["min_odds"],
            max_odds=row["max_odds"],
        ),
        active=row["active"],
        created_at=row["created_at"],
        created_by=row["created_by"],
        reason=row["reason"],
    )


def _selection(row: dict[str, Any]) -> SelectionRecord:
    return SelectionRecord(
        id=str(row["id"]),
        market_id=str(row["market_id"]),
        match_id=str(row["match_id"]),
        code=row["code"],
        label=row["label"],
        probability=row["probability"],
        odds=row["odds"],
        sort_order=row["sort_order"],
    )


def _market(row: dict[str, Any], selections: list[SelectionRecord]) -> MarketRecord:
    return MarketRecord(
        id=str(row["id"]),
        match_id=str(row["match_id"]),
        type=row["type"],
        line=row["line"],
        status=row["status"],
        odds_version=row["odds_version"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        selections=tuple(selections),
    )


@dataclass(frozen=True)
class PostgresOddsRepository(OddsRepository):
    pool: Pool

    async def get_active_configuration(self) -> ConfigurationRecord:
        async with transaction(self.pool) as connection:
            return await self._active_configuration(connection)

    async def insert_configuration(
        self,
        margins: dict[str, Decimal],
        min_odds: Decimal,
        max_odds: Decimal,
        created_by: str,
        reason: str,
        before_commit: ConfigurationCommitGuard,
    ) -> ConfigurationRecord:
        async with transaction(self.pool) as connection:
            await connection.execute(
                "SELECT pg_advisory_xact_lock(hashtext('odds:configuration'))"
            )
            before = await self._active_configuration(connection)
            await connection.execute(
                "UPDATE odds.pricing_configurations SET active = false WHERE active"
            )
            cursor = await connection.execute(
                f"""
                INSERT INTO odds.pricing_configurations
                    (version, margins, min_odds, max_odds, active, created_by,
                     reason)
                SELECT COALESCE(MAX(version), 0) + 1, %s, %s, %s, true, %s, %s
                  FROM odds.pricing_configurations
                RETURNING {_CONFIGURATION_COLUMNS}
                """,
                (
                    Jsonb({name: float(value) for name, value in margins.items()}),
                    min_odds,
                    max_odds,
                    created_by,
                    reason,
                ),
            )
            row = await cursor.fetchone()
            assert row is not None
            after = _configuration(row)

            await before_commit(before, after)

            return after

    async def find_publication(self, match_id: str) -> PublishOutcome | None:
        async with transaction(self.pool) as connection:
            return await self._publication(connection, match_id)

    async def publish_markets(
        self,
        match_id: str,
        markets: tuple[PricedMarket, ...],
        pricing_version: int,
        model_version: str,
        model_configuration_version: int,
    ) -> PublishOutcome:
        async with transaction(self.pool) as connection:
            # Racing publishers serialise here; the loser returns the winner's rows.
            await connection.execute(
                "SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))",
                (f"odds:publish:{match_id}",),
            )
            existing = await self._publication(connection, match_id)

            if existing is not None:
                return existing

            market_ids: list[str] = []

            for market_order, market in enumerate(markets):
                market_id = str(uuid4())
                market_ids.append(market_id)
                await connection.execute(
                    """
                    INSERT INTO odds.markets
                        (id, match_id, type, line, status, odds_version,
                         sort_order, pricing_version, model_version,
                         model_configuration_version)
                    VALUES (%s, %s, %s, %s, %s, 1, %s, %s, %s, %s)
                    """,
                    (
                        market_id,
                        match_id,
                        market.type,
                        market.line,
                        MarketStatusValue.OPEN,
                        market_order,
                        pricing_version,
                        model_version,
                        model_configuration_version,
                    ),
                )

                async with connection.cursor() as cursor:
                    await cursor.executemany(
                        """
                        INSERT INTO odds.market_selections
                            (id, market_id, match_id, code, label, probability,
                             odds, sort_order)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        [
                            (
                                str(uuid4()),
                                market_id,
                                match_id,
                                selection.code,
                                selection.label,
                                selection.probability,
                                selection.odds,
                                selection_order,
                            )
                            for selection_order, selection in enumerate(
                                market.selections
                            )
                        ],
                    )

            await connection.execute(
                _SNAPSHOT_SQL, (SnapshotReasonValue.INITIAL, market_ids)
            )

            return PublishOutcome(
                match_id=match_id,
                markets=len(market_ids),
                odds_version=1,
                created=True,
            )

    async def set_match_markets_status(
        self, match_id: str, status: str, allowed_from: frozenset[str]
    ) -> int:
        async with transaction(self.pool) as connection:
            cursor = await connection.execute(
                """
                UPDATE odds.markets
                   SET status = %s, odds_version = odds_version + 1,
                       updated_at = now()
                 WHERE match_id = %s AND status = ANY(%s)
                RETURNING id
                """,
                (status, match_id, sorted(allowed_from)),
            )
            market_ids = [str(row["id"]) for row in await cursor.fetchall()]

            if market_ids:
                await connection.execute(
                    _SNAPSHOT_SQL, (SnapshotReasonValue.STATUS_CHANGE, market_ids)
                )

            return len(market_ids)

    async def change_market_status(
        self,
        market_id: str,
        decide: StatusDecision,
        before_commit: MarketCommitGuard,
    ) -> MarketRecord | None:
        """Change one market's status under a row lock; ``None`` if absent."""
        async with transaction(self.pool) as connection:
            cursor = await connection.execute(
                f"SELECT {_MARKET_COLUMNS} FROM odds.markets WHERE id = %s FOR UPDATE",
                (market_id,),
            )
            row = await cursor.fetchone()

            if row is None:
                return None

            selections = await self._selections(connection, [market_id])
            before = _market(row, selections.get(market_id, []))
            status = decide(before)

            cursor = await connection.execute(
                f"""
                UPDATE odds.markets
                   SET status = %s, odds_version = odds_version + 1,
                       updated_at = now()
                 WHERE id = %s
                RETURNING {_MARKET_COLUMNS}
                """,
                (status, market_id),
            )
            updated = await cursor.fetchone()
            assert updated is not None
            await connection.execute(
                _SNAPSHOT_SQL, (SnapshotReasonValue.STATUS_CHANGE, [market_id])
            )
            after = _market(updated, selections.get(market_id, []))

            await before_commit(before, after)

            return after

    async def get_market(self, market_id: str) -> MarketRecord | None:
        async with transaction(self.pool) as connection:
            cursor = await connection.execute(
                f"SELECT {_MARKET_COLUMNS} FROM odds.markets WHERE id = %s",
                (market_id,),
            )
            markets = await self._with_selections(connection, await cursor.fetchall())

            return markets[0] if markets else None

    async def list_markets(self, match_ids: list[str]) -> list[MarketRecord]:
        if not match_ids:
            return []

        async with transaction(self.pool) as connection:
            cursor = await connection.execute(
                f"SELECT {_MARKET_COLUMNS} FROM odds.markets "
                "WHERE match_id = ANY(%s::uuid[]) ORDER BY match_id, sort_order",
                (match_ids,),
            )

            return await self._with_selections(connection, await cursor.fetchall())

    async def list_trading_markets(self, limit: int) -> list[MarketRecord]:
        async with transaction(self.pool) as connection:
            cursor = await connection.execute(
                f"SELECT {_MARKET_COLUMNS} FROM odds.markets "
                "WHERE status = ANY(%s) "
                "ORDER BY created_at DESC, match_id, sort_order LIMIT %s",
                (_TRADING_STATUSES, limit),
            )

            return await self._with_selections(connection, await cursor.fetchall())

    async def list_snapshots(self, market_id: str, limit: int) -> list[SnapshotRecord]:
        """Return up to ``limit`` of a market's snapshots, oldest first."""
        async with transaction(self.pool) as connection:
            cursor = await connection.execute(
                "SELECT id, market_id, match_id, odds_version, reason, prices, "
                "created_at FROM odds.odds_snapshots WHERE market_id = %s "
                "ORDER BY odds_version LIMIT %s",
                (market_id, limit),
            )

            return [
                SnapshotRecord(
                    id=str(row["id"]),
                    market_id=str(row["market_id"]),
                    match_id=str(row["match_id"]),
                    odds_version=row["odds_version"],
                    reason=row["reason"],
                    prices=row["prices"],
                    created_at=row["created_at"],
                )
                for row in await cursor.fetchall()
            ]

    async def opening_odds(self, market_ids: list[str]) -> dict[str, Decimal]:
        if not market_ids:
            return {}

        async with transaction(self.pool) as connection:
            cursor = await connection.execute(
                """
                SELECT price->>'selectionId' AS selection_id,
                       (price->>'odds')::numeric(8, 2) AS odds
                  FROM odds.odds_snapshots snapshot,
                       jsonb_array_elements(snapshot.prices) AS price
                 WHERE snapshot.market_id = ANY(%s::uuid[])
                   AND snapshot.odds_version = 1
                """,
                (market_ids,),
            )

            return {row["selection_id"]: row["odds"] for row in await cursor.fetchall()}

    async def _active_configuration(
        self, connection: Connection
    ) -> ConfigurationRecord:
        cursor = await connection.execute(
            f"SELECT {_CONFIGURATION_COLUMNS} "
            "FROM odds.pricing_configurations WHERE active"
        )
        row = await cursor.fetchone()

        if row is None:
            raise RuntimeError("odds.pricing_configurations has no active version.")

        return _configuration(row)

    async def _publication(
        self, connection: Connection, match_id: str
    ) -> PublishOutcome | None:
        cursor = await connection.execute(
            "SELECT count(*) AS markets, max(odds_version) AS odds_version "
            "FROM odds.markets WHERE match_id = %s",
            (match_id,),
        )
        row = await cursor.fetchone()

        if row is None or row["markets"] == 0:
            return None

        return PublishOutcome(
            match_id=match_id,
            markets=row["markets"],
            odds_version=row["odds_version"],
            created=False,
        )

    async def _selections(
        self, connection: Connection, market_ids: list[str]
    ) -> dict[str, list[SelectionRecord]]:
        grouped: dict[str, list[SelectionRecord]] = {}

        if not market_ids:
            return grouped

        cursor = await connection.execute(
            f"SELECT {_SELECTION_COLUMNS} FROM odds.market_selections "
            "WHERE market_id = ANY(%s::uuid[]) ORDER BY market_id, sort_order",
            (market_ids,),
        )

        for row in await cursor.fetchall():
            selection = _selection(row)
            grouped.setdefault(selection.market_id, []).append(selection)

        return grouped

    async def _with_selections(
        self, connection: Connection, rows: list[dict[str, Any]]
    ) -> list[MarketRecord]:
        selections = await self._selections(
            connection, [str(row["id"]) for row in rows]
        )

        return [_market(row, selections.get(str(row["id"]), [])) for row in rows]
