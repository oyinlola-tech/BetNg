from __future__ import annotations

import logging
import os
import uuid
from collections.abc import AsyncIterator, Iterator, Sequence
from contextlib import contextmanager
from typing import Any

import pytest
from betng_service_kit import Pool, ServiceSettings, apply_migrations, create_pool
from fastapi.testclient import TestClient

from betng_simulation.app import create_app
from betng_simulation.configs import (
    DATABASE_SCHEMA,
    DATABASE_URL_VARIABLE,
    MIGRATIONS_DIRECTORY,
    SERVICE_NAME,
    SERVICE_VERSION,
)
from betng_simulation.engine import (
    ModelConfiguration,
    SimulationTeam,
    TeamStrength,
    simulate,
)
from betng_simulation.interfaces import AuditEntry, MatchView, Simulate
from betng_simulation.repositories import SimulationRepository

# Integration tests run against `betng_test`, never the development database.
TEST_DATABASE_URL = os.environ.get(
    "SIMULATION_TEST_DATABASE_URL",
    "postgresql://betng_simulation:betng_simulation_local@localhost:55432/betng_test",
)
os.environ[DATABASE_URL_VARIABLE] = TEST_DATABASE_URL

LOGGER = logging.getLogger("simulation-tests")

STRONG = TeamStrength(
    attack=82,
    defence=78,
    midfield=80,
    goalkeeping=77,
    pace=79,
    finishing=83,
    possession=70,
    form=3,
    home_advantage=65,
)
WEAK = TeamStrength(
    attack=52,
    defence=55,
    midfield=54,
    goalkeeping=58,
    pace=57,
    finishing=50,
    possession=45,
    form=-2,
    home_advantage=50,
)
HOME_TEAM = SimulationTeam(
    "22222222-2222-4222-8222-222222222221", "Lagos Lions", "LAG", STRONG
)
AWAY_TEAM = SimulationTeam(
    "22222222-2222-4222-8222-222222222222", "Abuja Eagles", "ABJ", WEAK
)


def strength_json(strength: TeamStrength) -> dict[str, float]:
    return {
        "attack": strength.attack,
        "defence": strength.defence,
        "midfield": strength.midfield,
        "goalkeeping": strength.goalkeeping,
        "pace": strength.pace,
        "finishing": strength.finishing,
        "possession": strength.possession,
        "form": strength.form,
        "homeAdvantage": strength.home_advantage,
    }


def team_json(team: SimulationTeam) -> dict[str, Any]:
    return {
        "teamId": team.team_id,
        "name": team.name,
        "shortName": team.short_name,
        "strength": strength_json(team.strength),
    }


def run_match_payload(match_id: str) -> dict[str, Any]:
    return {
        "matchId": match_id,
        "home": team_json(HOME_TEAM),
        "away": team_json(AWAY_TEAM),
    }


def new_match_id() -> str:
    return str(uuid.uuid4())


class FakeAuditRecorder:
    def __init__(self) -> None:
        self.entries: list[AuditEntry] = []
        self.fail = False

    async def record(self, entry: AuditEntry) -> None:
        if self.fail:
            raise ConnectionError("identity is down")

        self.entries.append(entry)

    def actions(self) -> list[str]:
        return [entry.action for entry in self.entries]


class FakeMatchReadModel:
    def __init__(self) -> None:
        self.matches: dict[str, MatchView] = {}

    async def get_matches(self, match_ids: Sequence[str]) -> dict[str, MatchView]:
        return {
            match_id: self.matches[match_id]
            for match_id in match_ids
            if match_id in self.matches
        }


def failing_simulate(
    match_id: str,
    home: SimulationTeam,
    away: SimulationTeam,
    configuration: ModelConfiguration,
    seed_secret: str | None = None,
) -> Any:
    raise ValueError("the engine was made to fail")


@pytest.fixture(autouse=True)
def _no_internal_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("INTERNAL_SERVICE_TOKEN", raising=False)
    monkeypatch.delenv("SIMULATION_SEED_SECRET", raising=False)


@pytest.fixture
async def pool() -> AsyncIterator[Pool]:
    database_pool = create_pool(TEST_DATABASE_URL, max_size=4)
    await database_pool.open()

    try:
        await apply_migrations(
            database_pool, DATABASE_SCHEMA, MIGRATIONS_DIRECTORY, LOGGER
        )
        await SimulationRepository(database_pool).ensure_default_configuration(
            ModelConfiguration()
        )
        yield database_pool
    finally:
        await database_pool.close()


@pytest.fixture
def repository(pool: Pool) -> SimulationRepository:
    return SimulationRepository(pool)


@pytest.fixture
def audit() -> FakeAuditRecorder:
    return FakeAuditRecorder()


@pytest.fixture
def matches() -> FakeMatchReadModel:
    return FakeMatchReadModel()


def test_settings() -> ServiceSettings:
    return ServiceSettings(
        service_name=SERVICE_NAME, version=SERVICE_VERSION, NODE_ENV="test"
    )


@contextmanager
def running_client(
    audit: FakeAuditRecorder,
    matches: FakeMatchReadModel,
    simulate_match: Simulate = simulate,
) -> Iterator[TestClient]:
    app = create_app(
        test_settings(),
        audit_recorder=audit,
        match_read_model=matches,
        simulate_match=simulate_match,
    )

    with TestClient(app, raise_server_exceptions=False) as client:
        yield client


@pytest.fixture
def client(
    audit: FakeAuditRecorder, matches: FakeMatchReadModel
) -> Iterator[TestClient]:
    with running_client(audit, matches) as test_client:
        yield test_client


def admin_headers(*permissions: str, kind: str = "ADMIN") -> dict[str, str]:
    return {
        "x-betng-actor-kind": kind,
        "x-betng-actor-id": "33333333-3333-4333-8333-333333333331",
        "x-betng-actor-role": "SUPER_ADMIN",
        "x-betng-actor-name": "Test%20Admin",
        "x-betng-permissions": ",".join(permissions),
    }
