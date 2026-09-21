from __future__ import annotations

import uuid
from collections.abc import AsyncIterator, Iterator
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import quote

import psycopg
import pytest
from betng_service_kit import Pool, create_pool
from psycopg.rows import dict_row

from betng_odds.repositories import PostgresExposureReader, PostgresMatchDirectory
from conftest import REPOSITORY_ROOT, TEST_DATABASE

Superuser = psycopg.Connection[dict[str, Any]]


def _superuser_url() -> str:
    values = dict(
        line.split("=", 1)
        for line in (REPOSITORY_ROOT / ".env").read_text(encoding="utf-8").splitlines()
        if line.startswith("POSTGRES_") and "=" in line
    )
    host = values.get("POSTGRES_HOST", "localhost").strip()
    host = "localhost" if host in {"postgres", ""} else host

    return (
        f"postgresql://{quote(values['POSTGRES_USER'].strip())}:"
        f"{quote(values['POSTGRES_PASSWORD'].strip())}@{host}:"
        f"{values['POSTGRES_PORT'].strip()}/{TEST_DATABASE}"
    )


@pytest.fixture
def superuser() -> Iterator[Superuser]:
    with psycopg.connect(
        _superuser_url(), row_factory=dict_row, autocommit=True
    ) as connection:
        present = connection.execute(
            "SELECT to_regclass('match.matches') IS NOT NULL "
            "AND to_regclass('betting.bet_selections') IS NOT NULL AS present"
        ).fetchone()

        if present is None or not present["present"]:
            pytest.skip("The match and betting schemas are not migrated yet.")

        yield connection


@pytest.fixture
async def pool(database_url: str) -> AsyncIterator[Pool]:
    pool = create_pool(database_url, max_size=2)
    await pool.open()

    try:
        yield pool
    finally:
        await pool.close()


def insert_match(superuser: Superuser, closes_at: datetime) -> str:
    league_id, home_id, away_id, fixture_id, match_id = (
        str(uuid.uuid4()) for _ in range(5)
    )
    tag = uuid.uuid4().hex[:8].upper()
    superuser.execute(
        "INSERT INTO match.leagues (id, name, code, slug, country) "
        "VALUES (%s, %s, %s, %s, 'Nigeria')",
        (league_id, f"Odds Test League {tag}", tag, f"odds-test-{tag.lower()}"),
    )

    for team_id, name, short_name in (
        (home_id, "Lagos Lions", "LIO"),
        (away_id, "Abuja Tigers", "TIG"),
    ):
        superuser.execute(
            "INSERT INTO match.teams (id, league_id, name, short_name, code, "
            "strength, attack, defence, midfield, goalkeeping, pace, finishing, "
            "possession, updated_at) "
            "VALUES (%s, %s, %s, %s, %s, 70, 70, 70, 70, 70, 70, 70, 70, now())",
            (team_id, league_id, name, short_name, short_name),
        )

    superuser.execute(
        "INSERT INTO match.fixtures (id, league_id, matchday, home_team_id, "
        "away_team_id, kickoff_at, betting_closes_at) "
        "VALUES (%s, %s, 1, %s, %s, %s, %s)",
        (
            fixture_id,
            league_id,
            home_id,
            away_id,
            closes_at + timedelta(seconds=10),
            closes_at,
        ),
    )
    superuser.execute(
        "INSERT INTO match.matches (id, fixture_id, lifecycle, updated_at) "
        "VALUES (%s, %s, 'BETTING_OPEN', now())",
        (match_id, fixture_id),
    )

    return match_id


def insert_bet(
    superuser: Superuser,
    selection_id: str,
    market_id: str,
    stake: int,
    payout: int,
    status: str,
) -> None:
    bet_id = str(uuid.uuid4())
    settled = status != "PENDING"
    superuser.execute(
        "INSERT INTO betting.bets (id, user_id, channel, stake, total_odds, "
        "potential_payout, status, payout, settled_at, idempotency_key, placed_at) "
        "VALUES (%s, %s, 'ONLINE', %s, 2.00, %s, %s::betting.bet_status, %s, %s, "
        "%s, now())",
        (
            bet_id,
            str(uuid.uuid4()),
            stake,
            payout,
            status,
            payout if settled else None,
            datetime.now(UTC) if settled else None,
            f"odds-test-{bet_id}",
        ),
    )
    superuser.execute(
        "INSERT INTO betting.bet_selections (id, bet_id, match_id, market_id, "
        "selection_id, league_id, market_type, selection_code, odds, odds_version, "
        "market_label, selection_label, match_label, league_name, kickoff_at) "
        "VALUES (%s, %s, %s, %s, %s, %s, 'MATCH_RESULT', 'HOME', 2.00, 1, "
        "'Match Result', 'LIO', 'Lagos Lions v Abuja Tigers', 'Odds Test', now())",
        (
            str(uuid.uuid4()),
            bet_id,
            str(uuid.uuid4()),
            market_id,
            selection_id,
            str(uuid.uuid4()),
        ),
    )


class TestPostgresMatchDirectory:
    async def test_reads_teams_league_lifecycle_and_close(
        self, superuser: Superuser, pool: Pool
    ) -> None:
        closes_at = datetime.now(UTC).replace(microsecond=0) + timedelta(minutes=3)
        match_id = insert_match(superuser, closes_at)
        missing = str(uuid.uuid4())

        found = await PostgresMatchDirectory(pool).find([match_id, missing])

        assert set(found) == {match_id}
        match = found[match_id]
        assert match.label == "Lagos Lions v Abuja Tigers"
        assert (match.home_short_name, match.away_short_name) == ("LIO", "TIG")
        assert match.league_name.startswith("Odds Test League")
        assert match.lifecycle == "BETTING_OPEN"
        assert match.betting_closes_at == closes_at

    async def test_an_empty_request_reads_nothing(self, pool: Pool) -> None:
        assert await PostgresMatchDirectory(pool).find([]) == {}


class TestPostgresExposureReader:
    async def test_sums_pending_bets_only(
        self, superuser: Superuser, pool: Pool
    ) -> None:
        market_id, selection_id = str(uuid.uuid4()), str(uuid.uuid4())
        insert_bet(superuser, selection_id, market_id, 10_000, 25_000, "PENDING")
        insert_bet(superuser, selection_id, market_id, 5_000, 9_000, "PENDING")
        insert_bet(superuser, selection_id, market_id, 70_000, 900_000, "WON")

        exposure = await PostgresExposureReader(pool).by_selection([market_id])

        assert set(exposure) == {selection_id}
        assert exposure[selection_id].stake == 15_000
        assert exposure[selection_id].liability == (25_000 - 10_000) + (9_000 - 5_000)


class TestOddsLoginBoundary:
    def test_the_odds_login_cannot_write_another_schema(
        self, superuser: Superuser, database: psycopg.Connection[dict[str, Any]]
    ) -> None:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            database.execute(
                "UPDATE match.matches SET home_score = 9 WHERE id = %s",
                (str(uuid.uuid4()),),
            )
        database.rollback()
