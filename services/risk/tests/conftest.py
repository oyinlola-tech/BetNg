"""Fixtures; tests run in ``betng_test_risk`` and remove only own rows."""

from __future__ import annotations

import os
import uuid
from collections.abc import Iterator
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

import psycopg
import pytest
from betng_service_kit import ServiceSettings
from fastapi.testclient import TestClient
from psycopg.rows import dict_row

from betng_risk.app import create_app
from betng_risk.configs import SERVICE_NAME, SERVICE_VERSION
from betng_risk.errors import AuditUnavailableError
from betng_risk.types import AuditEntry

TEST_DATABASE_URL = os.environ.get(
    "RISK_TEST_DATABASE_URL",
    "postgresql://betng_risk:betng_risk_local@localhost:55432/betng_test_risk",
)
SUPERUSER_URL = os.environ.get(
    "RISK_TEST_SUPERUSER_URL",
    "postgresql://betng:betng_local_dev@localhost:55432/betng_test_risk",
)

os.environ["RISK_DATABASE_URL"] = TEST_DATABASE_URL

DEFAULT_LIMITS: dict[str, int] = {
    "min_stake": 5_000,
    "max_stake_per_bet": 50_000_000,
    "max_payout_per_bet": 2_000_000_000,
    "max_liability_per_selection": 1_500_000_000,
    "max_liability_per_market": 3_000_000_000,
    "max_liability_per_match": 6_000_000_000,
}

FIXTURE_TABLES = """
CREATE TABLE IF NOT EXISTS match.leagues (
    id uuid PRIMARY KEY, name text NOT NULL, code text NOT NULL, slug text NOT NULL,
    country text NOT NULL, sport text NOT NULL, status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS match.teams (
    id uuid PRIMARY KEY, league_id uuid NOT NULL, name text NOT NULL,
    short_name text NOT NULL, code text NOT NULL, city text, stadium text,
    color_primary text, color_secondary text, strength integer, attack integer,
    defence integer, midfield integer, goalkeeping integer, pace integer,
    finishing integer, possession integer, form integer, home_advantage integer,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS match.fixtures (
    id uuid PRIMARY KEY, league_id uuid NOT NULL, season text NOT NULL,
    matchday integer NOT NULL, home_team_id uuid NOT NULL, away_team_id uuid NOT NULL,
    kickoff_at timestamptz NOT NULL, betting_closes_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS match.matches (
    id uuid PRIMARY KEY, fixture_id uuid NOT NULL UNIQUE, status text NOT NULL,
    lifecycle text NOT NULL, home_score integer, away_score integer,
    revealed_sequence integer NOT NULL DEFAULT 0, completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS odds.markets (
    id uuid PRIMARY KEY, match_id uuid NOT NULL, type text NOT NULL,
    line numeric(4,1), status text NOT NULL, odds_version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS odds.market_selections (
    id uuid PRIMARY KEY, market_id uuid NOT NULL, match_id uuid NOT NULL,
    code text NOT NULL, label text NOT NULL, probability numeric(9,6) NOT NULL,
    odds numeric(8,2) NOT NULL, sort_order integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS betting.bets (
    id uuid PRIMARY KEY, user_id uuid, channel text NOT NULL, shop_id uuid,
    cashier_id uuid, stake bigint NOT NULL, currency text NOT NULL DEFAULT 'NGN',
    total_odds numeric(12,2) NOT NULL, potential_payout bigint NOT NULL,
    status text NOT NULL, payout bigint, risk_decision_id uuid,
    idempotency_key text NOT NULL, placed_at timestamptz NOT NULL DEFAULT now(),
    settled_at timestamptz, cancelled_at timestamptz
);
CREATE TABLE IF NOT EXISTS betting.bet_selections (
    id uuid PRIMARY KEY, bet_id uuid NOT NULL, match_id uuid NOT NULL,
    market_id uuid NOT NULL, selection_id uuid NOT NULL, league_id uuid NOT NULL,
    market_type text NOT NULL, selection_code text NOT NULL, line numeric(4,1),
    odds numeric(8,2) NOT NULL, odds_version integer NOT NULL,
    market_label text NOT NULL, selection_label text NOT NULL,
    match_label text NOT NULL, league_name text NOT NULL,
    kickoff_at timestamptz NOT NULL, outcome text NOT NULL DEFAULT 'PENDING',
    result text
);
"""

FIXTURE_TABLE_NAMES = (
    "match.leagues",
    "match.teams",
    "match.fixtures",
    "match.matches",
    "odds.markets",
    "odds.market_selections",
    "betting.bets",
    "betting.bet_selections",
)


def _table_exists(connection: psycopg.Connection[Any], name: str) -> bool:
    row = connection.execute("SELECT to_regclass(%s) AS oid", (name,)).fetchone()
    return row is not None and row["oid"] is not None


@pytest.fixture(scope="session")
def superuser() -> Iterator[psycopg.Connection[Any]]:
    with psycopg.connect(
        SUPERUSER_URL, autocommit=True, row_factory=dict_row
    ) as connection:
        missing = [
            name for name in FIXTURE_TABLE_NAMES if not _table_exists(connection, name)
        ]
        connection.execute(FIXTURE_TABLES)
        # Only tables this run created are granted; existing ones are left
        # exactly as their owner made them.
        for name in missing:
            connection.execute(f"GRANT SELECT ON {name} TO betng_reader")

        yield connection


@dataclass(frozen=True)
class Selection:
    id: str
    code: str
    odds: Decimal


@dataclass(frozen=True)
class Market:
    id: str
    match_id: str
    type: str
    selections: dict[str, Selection]


@dataclass(frozen=True)
class Match:
    id: str
    league_id: str
    league_name: str
    label: str
    kickoff_at: datetime


@dataclass
class Book:
    """Inserts catalogue and bet rows as the superuser and removes them after."""

    connection: psycopg.Connection[Any]
    _created: list[tuple[str, str]] = field(default_factory=list)

    def _insert(self, table: str, row: dict[str, Any]) -> None:
        columns = ", ".join(row)
        placeholders = ", ".join(["%s"] * len(row))
        self.connection.execute(
            f"INSERT INTO {table} ({columns}) VALUES ({placeholders})",
            list(row.values()),
        )
        self._created.append((table, str(row["id"])))

    def match(
        self,
        *,
        lifecycle: str = "BETTING_OPEN",
        status: str = "BETTING_OPEN",
        closes_in: timedelta = timedelta(minutes=5),
        kickoff_in: timedelta = timedelta(minutes=10),
    ) -> Match:
        now = datetime.now(UTC)
        league_id, home_id, away_id, fixture_id, match_id = (
            str(uuid.uuid4()) for _ in range(5)
        )
        tag = league_id[:8]
        league_name = f"Test League {tag}"

        self._insert(
            "match.leagues",
            {
                "id": league_id,
                "name": league_name,
                "code": f"T{tag[:4]}",
                "slug": f"test-{tag}",
                "country": "NG",
                "sport": "FOOTBALL",
                "status": "ACTIVE",
            },
        )
        for team_id, name in ((home_id, f"Home {tag}"), (away_id, f"Away {tag}")):
            self._insert(
                "match.teams",
                {
                    "id": team_id,
                    "league_id": league_id,
                    "name": name,
                    "short_name": name[:3].upper(),
                    "code": name[:3].upper(),
                },
            )
        self._insert(
            "match.fixtures",
            {
                "id": fixture_id,
                "league_id": league_id,
                "season": "2026",
                "matchday": 1,
                "home_team_id": home_id,
                "away_team_id": away_id,
                "kickoff_at": now + kickoff_in,
                "betting_closes_at": now + closes_in,
            },
        )
        self._insert(
            "match.matches",
            {
                "id": match_id,
                "fixture_id": fixture_id,
                "status": status,
                "lifecycle": lifecycle,
            },
        )

        return Match(
            id=match_id,
            league_id=league_id,
            league_name=league_name,
            label=f"Home {tag} v Away {tag}",
            kickoff_at=now + kickoff_in,
        )

    def market(
        self,
        match: Match,
        *,
        type: str = "MATCH_RESULT",  # noqa: A002 - mirrors the column name
        status: str = "OPEN",
        line: Decimal | None = None,
        prices: dict[str, str] | None = None,
    ) -> Market:
        market_id = str(uuid.uuid4())
        self._insert(
            "odds.markets",
            {
                "id": market_id,
                "match_id": match.id,
                "type": type,
                "line": line,
                "status": status,
            },
        )

        selections: dict[str, Selection] = {}
        for order, (code, odds) in enumerate(
            (prices or {"HOME": "2.00", "DRAW": "3.40", "AWAY": "3.80"}).items()
        ):
            selection_id = str(uuid.uuid4())
            self._insert(
                "odds.market_selections",
                {
                    "id": selection_id,
                    "market_id": market_id,
                    "match_id": match.id,
                    "code": code,
                    "label": code.title(),
                    "probability": Decimal("0.333333"),
                    "odds": Decimal(odds),
                    "sort_order": order,
                },
            )
            selections[code] = Selection(selection_id, code, Decimal(odds))

        return Market(id=market_id, match_id=match.id, type=type, selections=selections)

    def bet(
        self,
        stake: int,
        legs: list[tuple[Match, Market, str]],
        *,
        user_id: str | None = None,
        shop_id: str | None = None,
        status: str = "PENDING",
    ) -> str:
        bet_id = str(uuid.uuid4())
        numerator = 1
        for _, market, code in legs:
            numerator *= int(market.selections[code].odds * 100)
        denominator = 100 ** len(legs)

        self._insert(
            "betting.bets",
            {
                "id": bet_id,
                "user_id": user_id if shop_id is None else None,
                "channel": "ONLINE" if shop_id is None else "SHOP",
                "shop_id": shop_id,
                "cashier_id": str(uuid.uuid4()) if shop_id is not None else None,
                "stake": stake,
                "total_odds": Decimal(numerator * 100 // denominator) / 100,
                "potential_payout": stake * numerator // denominator,
                "status": status,
                "idempotency_key": str(uuid.uuid4()),
            },
        )
        for match, market, code in legs:
            selection = market.selections[code]
            self._insert(
                "betting.bet_selections",
                {
                    "id": str(uuid.uuid4()),
                    "bet_id": bet_id,
                    "match_id": match.id,
                    "market_id": market.id,
                    "selection_id": selection.id,
                    "league_id": match.league_id,
                    "market_type": market.type,
                    "selection_code": code,
                    "odds": selection.odds,
                    "odds_version": 1,
                    "market_label": "Match Result",
                    "selection_label": code.title(),
                    "match_label": match.label,
                    "league_name": match.league_name,
                    "kickoff_at": match.kickoff_at,
                },
            )

        return bet_id

    def set_market_status(self, market: Market, status: str) -> None:
        self.connection.execute(
            "UPDATE odds.markets SET status = %s WHERE id = %s", (status, market.id)
        )

    def cleanup(self) -> None:
        match_ids = [
            row_id for table, row_id in self._created if table == "match.matches"
        ]
        self.connection.execute(
            "DELETE FROM risk.exposure_freezes WHERE match_id = ANY(%s::uuid[])",
            (match_ids,),
        )
        for table, row_id in reversed(self._created):
            self.connection.execute(f"DELETE FROM {table} WHERE id = %s", (row_id,))


@pytest.fixture
def book(superuser: psycopg.Connection[Any]) -> Iterator[Book]:
    fixture = Book(superuser)
    yield fixture
    fixture.cleanup()


class FakeAudit:
    """Stands in for the identity service's audit procedure."""

    def __init__(self) -> None:
        self.entries: list[AuditEntry] = []
        self.fail = False

    async def record(self, entry: AuditEntry) -> None:
        if self.fail:
            raise AuditUnavailableError
        self.entries.append(entry)


@pytest.fixture
def audit() -> FakeAudit:
    return FakeAudit()


@pytest.fixture
def client(
    audit: FakeAudit, superuser: psycopg.Connection[Any]
) -> Iterator[TestClient]:
    settings = ServiceSettings(
        service_name=SERVICE_NAME, version=SERVICE_VERSION, NODE_ENV="test"
    )
    with TestClient(
        create_app(settings, audit=audit), raise_server_exceptions=False
    ) as test_client:
        yield test_client


def force_limits(connection: psycopg.Connection[Any], **overrides: int) -> None:
    """Put a limits version in force directly, bypassing the admin route."""
    amounts = {**DEFAULT_LIMITS, **overrides}
    connection.execute("UPDATE risk.risk_limits SET active = false WHERE active")
    connection.execute(
        """
        INSERT INTO risk.risk_limits (
            version, min_stake, max_stake_per_bet, max_payout_per_bet,
            max_liability_per_selection, max_liability_per_market,
            max_liability_per_match, active, created_by, reason
        )
        SELECT coalesce(max(version), 0) + 1, %s, %s, %s, %s, %s, %s, true,
               'test', 'Test limits'
        FROM risk.risk_limits
        """,
        [amounts[name] for name in DEFAULT_LIMITS],
    )


@pytest.fixture(autouse=True)
def default_limits(request: pytest.FixtureRequest) -> Iterator[None]:
    """Leave the default limits in force after a test that changed them."""
    yield

    if "superuser" not in request.fixturenames:
        return

    connection: psycopg.Connection[Any] = request.getfixturevalue("superuser")
    if not _table_exists(connection, "risk.risk_limits"):
        return

    row = connection.execute(
        "SELECT min_stake, max_stake_per_bet, max_payout_per_bet, "
        "max_liability_per_selection, max_liability_per_market, "
        "max_liability_per_match FROM risk.risk_limits WHERE active"
    ).fetchone()

    if row is not None and dict(row) != DEFAULT_LIMITS:
        force_limits(connection)


ADMIN_ID = "9d2f6c1e-5b7a-4c3d-8e9f-0a1b2c3d4e5f"


def admin_headers(*permissions: str) -> dict[str, str]:
    return {
        "x-betng-actor-kind": "ADMIN",
        "x-betng-actor-id": ADMIN_ID,
        "x-betng-actor-role": "RISK_ANALYST",
        "x-betng-actor-name": "Risk%20Analyst",
        "x-betng-permissions": ",".join(permissions),
    }


def evaluate_payload(
    stake: int, legs: list[tuple[Market, str]], *, actor_id: str | None = None
) -> dict[str, Any]:
    return {
        "actor": {"kind": "CUSTOMER", "id": actor_id or str(uuid.uuid4())},
        "stake": stake,
        "legs": [
            {
                "matchId": market.match_id,
                "marketId": market.id,
                "selectionId": market.selections[code].id,
                "odds": float(market.selections[code].odds),
            }
            for market, code in legs
        ],
    }


def rpc(
    client: TestClient, procedure: str, payload: Any, request_id: str | None = None
) -> dict[str, Any]:
    frame = {
        "id": str(uuid.uuid4()),
        "procedure": procedure,
        "payload": payload,
        "metadata": {} if request_id is None else {"requestId": request_id},
        "timestamp": 0,
    }
    response = client.post("/rpc", json=frame)
    assert response.status_code == 200
    return dict(response.json())
