from __future__ import annotations

import os
import random
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
from psycopg.types.json import Jsonb

from betng_analytics.app import create_app
from betng_analytics.configs import SERVICE_NAME, SERVICE_VERSION
from schema import TABLES

SUPERUSER_URL = os.environ.get(
    "ANALYTICS_TEST_SUPERUSER_URL",
    "postgresql://betng:betng_local_dev@localhost:55432/betng_test_analytics",
)
ANALYTICS_URL = os.environ.get(
    "ANALYTICS_TEST_DATABASE_URL",
    "postgresql://betng_analytics:betng_analytics_local@localhost:55432/"
    "betng_test_analytics",
)

INTERNAL_TOKEN = "analytics-test-internal-token-0001"
os.environ["INTERNAL_SERVICE_TOKEN"] = INTERNAL_TOKEN

ADMIN_ID = "0b0e3a52-5d1c-4a67-9d2f-0f6f4f1f7a01"


def admin_headers(*permissions: str) -> dict[str, str]:
    return {
        "x-betng-actor-kind": "ADMIN",
        "x-betng-actor-id": ADMIN_ID,
        "x-betng-actor-role": "OPERATIONS",
        "x-betng-actor-name": "Ops%20Admin",
        "x-betng-permissions": ",".join(permissions),
    }


REPORTS_ADMIN = admin_headers("reports:read")


def cashier_headers(
    cashier_id: str, shop_id: str | None, *permissions: str
) -> dict[str, str]:
    headers = {
        "x-betng-actor-kind": "CASHIER",
        "x-betng-actor-id": cashier_id,
        "x-betng-actor-role": "CASHIER",
        "x-betng-actor-name": "Till%20One",
        "x-betng-permissions": ",".join(permissions),
    }

    if shop_id is not None:
        headers["x-betng-shop-id"] = shop_id

    return headers


@dataclass(frozen=True)
class League:
    id: str
    name: str
    code: str


@dataclass(frozen=True)
class Match:
    id: str
    label: str
    league: League
    market_id: str
    selections: dict[str, str]
    season: int
    matchday: int
    kickoff_at: datetime


@dataclass(frozen=True)
class Shop:
    id: str
    code: str
    name: str


@dataclass(frozen=True)
class Cashier:
    id: str
    name: str
    shop: Shop


@dataclass(frozen=True)
class Bet:
    id: str
    stake: int
    potential_payout: int
    payout: int | None
    status: str
    settlement_id: str | None


def new_id() -> str:
    return str(uuid.uuid4())


@dataclass
class Book:
    """Fixture rows in one random past hour, deleted after the test."""

    connection: psycopg.Connection[Any]
    start: datetime
    _tracked: list[tuple[str, str, str]] = field(default_factory=list)

    @property
    def end(self) -> datetime:
        return self.start + timedelta(hours=1)

    @property
    def window(self) -> dict[str, str]:
        return {"from": self.start.isoformat(), "to": self.end.isoformat()}

    @property
    def day(self) -> str:
        return self.start.date().isoformat()

    def at(self, minutes: int) -> datetime:
        return self.start + timedelta(minutes=minutes)

    def insert(self, table: str, row: dict[str, Any], key: str = "id") -> None:
        columns = ", ".join(row)
        values = ", ".join(f"%({name})s" for name in row)
        self.connection.execute(
            f"INSERT INTO {table} ({columns}) VALUES ({values})".encode(), row
        )
        self._tracked.append((table, key, str(row[key])))

    def cleanup(self) -> None:
        for table, key, value in reversed(self._tracked):
            self.connection.execute(
                f"DELETE FROM {table} WHERE {key} = %s".encode(), (value,)
            )

    def league(self, name: str = "Premier Lagos") -> League:
        league = League(id=new_id(), name=name, code=f"L{uuid.uuid4().hex[:5]}".upper())
        self.insert(
            "match.leagues",
            {
                "id": league.id,
                "name": name,
                "code": league.code,
                "slug": league.code.lower(),
                "country": "NG",
                "sport": "FOOTBALL",
                "status": "ACTIVE",
            },
        )
        return league

    def team(self, league: League, name: str) -> str:
        team_id = new_id()
        self.insert(
            "match.teams",
            {
                "id": team_id,
                "league_id": league.id,
                "name": name,
                "short_name": name[:3].upper(),
                "code": name[:3].upper(),
            },
        )
        return team_id

    def match(
        self,
        league: League,
        *,
        status: str = "COMPLETED",
        result: tuple[int, int] | None = (2, 1),
        season: int = 1,
        matchday: int = 7,
        home: str = "Lagos United",
        away: str = "Kano Pillars",
    ) -> Match:
        fixture_id, match_id = new_id(), new_id()
        kickoff_at = self.at(30)
        self.insert(
            "match.fixtures",
            {
                "id": fixture_id,
                "league_id": league.id,
                "season": season,
                "matchday": matchday,
                "home_team_id": self.team(league, home),
                "away_team_id": self.team(league, away),
                "kickoff_at": kickoff_at,
                "betting_closes_at": kickoff_at - timedelta(seconds=10),
            },
        )
        self.insert(
            "match.matches",
            {
                "id": match_id,
                "fixture_id": fixture_id,
                "status": status,
                "lifecycle": "SETTLEMENT_COMPLETED"
                if status == "COMPLETED"
                else "EVENTS_PUBLISHED",
                "home_score": result[0] if result and status == "COMPLETED" else None,
                "away_score": result[1] if result and status == "COMPLETED" else None,
            },
        )

        if result is not None:
            home_goals, away_goals = result
            self.insert(
                "simulation.match_results",
                {
                    "match_id": match_id,
                    "simulation_id": new_id(),
                    "home_goals": home_goals,
                    "away_goals": away_goals,
                    "winner": "HOME"
                    if home_goals > away_goals
                    else "AWAY"
                    if away_goals > home_goals
                    else "DRAW",
                    "winning_gap": abs(home_goals - away_goals),
                    "seed": "seed",
                    "model_version": "poisson-1",
                    "configuration_version": 1,
                },
                key="match_id",
            )

        return Match(
            id=match_id,
            label=f"{home} vs {away}",
            league=league,
            market_id=new_id(),
            selections={code: new_id() for code in ("HOME", "DRAW", "AWAY")},
            season=season,
            matchday=matchday,
            kickoff_at=kickoff_at,
        )

    def customer(self, name: str = "Ada") -> str:
        customer_id = new_id()
        self.insert(
            "identity.customers",
            {
                "id": customer_id,
                "email": f"{customer_id}@example.test",
                "display_name": name,
                "status": "ACTIVE",
                "last_active_at": self.at(1),
            },
        )
        return customer_id

    def shop(self, name: str = "Ikeja Shop") -> Shop:
        shop = Shop(id=new_id(), code=f"S{uuid.uuid4().hex[:5]}".upper(), name=name)
        self.insert(
            "identity.shops",
            {
                "id": shop.id,
                "code": shop.code,
                "name": name,
                "address": "1 Allen Avenue",
                "phone": "0800000000",
                "email": f"{shop.code.lower()}@example.test",
                "status": "ACTIVE",
                "owner_name": "Owner",
            },
        )
        return shop

    def cashier(self, shop: Shop, name: str = "Till One") -> Cashier:
        cashier = Cashier(id=new_id(), name=name, shop=shop)
        self.insert(
            "identity.cashiers",
            {
                "id": cashier.id,
                "shop_id": shop.id,
                "username": f"till-{cashier.id[:8]}",
                "display_name": name,
                "role": "CASHIER",
                "status": "ACTIVE",
            },
        )
        return cashier

    def bet(
        self,
        match: Match,
        selection: str,
        stake: int,
        status: str,
        *,
        odds: str = "2.10",
        customer: str | None = None,
        cashier: Cashier | None = None,
        minute: int = 5,
        paid_by: Cashier | None = None,
        leg_result: str | None = None,
    ) -> Bet:
        bet_id = new_id()
        potential = stake * int(Decimal(odds) * 100) // 100
        payout = {"WON": potential, "LOST": 0, "VOID": stake}.get(status)
        settled = status in ("WON", "LOST", "VOID")
        placed_at = self.at(minute)

        self.insert(
            "betting.bets",
            {
                "id": bet_id,
                "user_id": customer,
                "channel": "SHOP" if cashier else "ONLINE",
                "shop_id": cashier.shop.id if cashier else None,
                "cashier_id": cashier.id if cashier else None,
                "stake": stake,
                "currency": "NGN",
                "total_odds": Decimal(odds),
                "potential_payout": potential,
                "status": status,
                "payout": payout,
                "idempotency_key": bet_id,
                "placed_at": placed_at,
                "settled_at": self.at(50) if settled else None,
                "cancelled_at": self.at(10) if status == "CANCELLED" else None,
            },
        )
        self.insert(
            "betting.bet_selections",
            {
                "id": new_id(),
                "bet_id": bet_id,
                "match_id": match.id,
                "market_id": match.market_id,
                "selection_id": match.selections[selection],
                "league_id": match.league.id,
                "market_type": "MATCH_RESULT",
                "selection_code": selection,
                "odds": Decimal(odds),
                "odds_version": 1,
                "market_label": "Match Result",
                "selection_label": selection.title(),
                "match_label": match.label,
                "league_name": match.league.name,
                "kickoff_at": match.kickoff_at,
                "outcome": status if settled else "PENDING",
                "result": leg_result,
            },
        )

        if cashier is not None:
            self.insert(
                "betting.tickets",
                {
                    "id": new_id(),
                    "bet_id": bet_id,
                    "code": f"T{uuid.uuid4().hex[:10]}".upper(),
                    "shop_id": cashier.shop.id,
                    "shop_code": cashier.shop.code,
                    "cashier_id": cashier.id,
                    "cashier_name": cashier.name,
                    "status": "PAID"
                    if paid_by
                    else "OPEN"
                    if status == "PENDING"
                    else status,
                    "paid_at": self.at(55) if paid_by else None,
                    "paid_by": paid_by.id if paid_by else None,
                    "expires_at": self.at(60 * 24 * 7),
                    "created_at": placed_at,
                },
            )

        settlement_id = None

        if settled:
            settlement_id = new_id()
            party = {
                "bet_id": bet_id,
                "outcome": status,
                "stake": stake,
                "payout": payout,
                "channel": "SHOP" if cashier else "ONLINE",
                "user_id": customer,
                "shop_id": cashier.shop.id if cashier else None,
                "cashier_id": cashier.id if cashier else None,
                "period_id": "SESSION-19000101-0001",
            }
            self.insert(
                "settlement.settlements",
                {
                    "id": settlement_id,
                    "revision": 1,
                    "settled_at": self.at(50),
                    **party,
                },
            )
            self.insert(
                "settlement.operator_ledger_entries",
                {
                    "id": new_id(),
                    "settlement_id": settlement_id,
                    "created_at": self.at(50),
                    **party,
                },
            )

        return Bet(bet_id, stake, potential, payout, status, settlement_id)

    def risk_decision(self, match: Match, decision: str) -> None:
        self.insert(
            "risk.risk_decisions",
            {
                "id": new_id(),
                "request_id": new_id(),
                "actor_kind": "CUSTOMER",
                "actor_id": new_id(),
                "stake_requested": 900_000_00,
                "total_odds": Decimal("2.10"),
                "decision": decision,
                "reason": "STAKE_LIMIT" if decision == "LIMIT" else "EXPOSURE_LIMIT",
                "max_stake": 0,
                "legs": Jsonb([{"matchId": match.id, "marketId": match.market_id}]),
                "limits_version": 1,
                "created_at": self.at(6),
            },
        )


@pytest.fixture(scope="session")
def superuser() -> Iterator[psycopg.Connection[Any]]:
    with psycopg.connect(SUPERUSER_URL, autocommit=True) as connection:
        for table, columns in TABLES.items():
            connection.execute(
                f"CREATE TABLE IF NOT EXISTS {table} ({columns})".encode()
            )
            connection.execute(f"GRANT SELECT ON {table} TO betng_reader".encode())

        yield connection


@pytest.fixture
def book(superuser: psycopg.Connection[Any]) -> Iterator[Book]:
    start = datetime(1900, 1, 1, 12, tzinfo=UTC) + timedelta(
        days=random.randrange(36_500)
    )
    book = Book(connection=superuser, start=start)

    try:
        yield book
    finally:
        book.cleanup()


@pytest.fixture(scope="session")
def client(superuser: psycopg.Connection[Any]) -> Iterator[TestClient]:
    os.environ["ANALYTICS_DATABASE_URL"] = ANALYTICS_URL
    os.environ["ANALYTICS_REPORT_TIMEZONE"] = "UTC"
    settings = ServiceSettings(
        service_name=SERVICE_NAME, version=SERVICE_VERSION, NODE_ENV="test"
    )

    with TestClient(create_app(settings)) as test_client:
        test_client.headers["x-betng-internal-token"] = INTERNAL_TOKEN
        yield test_client
