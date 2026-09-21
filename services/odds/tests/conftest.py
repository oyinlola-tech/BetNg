from __future__ import annotations

import math
import os
import uuid
from collections.abc import Iterator
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit, urlunsplit

import psycopg
import pytest
from betng_service_kit import ServiceSettings
from fastapi.testclient import TestClient
from psycopg.rows import dict_row

from betng_odds import PeerOverrides, create_app
from betng_odds.configs import SERVICE_NAME, SERVICE_VERSION
from betng_odds.dtos import ProbabilityMatrix, TeamStrength
from betng_odds.errors import AuditUnavailableError
from betng_odds.types import AuditEntry, MatchInfo, SelectionExposure

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
TEST_DATABASE = "betng_test"


def _development_url() -> str:
    configured = os.environ.get("ODDS_DATABASE_URL")

    if configured:
        return configured

    for line in (REPOSITORY_ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if line.startswith("ODDS_DATABASE_URL="):
            return line.split("=", 1)[1].strip()

    raise RuntimeError("ODDS_DATABASE_URL is not configured.")


def integration_database_url() -> str:
    parts = urlsplit(_development_url())

    return urlunsplit(parts._replace(path=f"/{TEST_DATABASE}"))


def poisson_matrix(home_xg: float, away_xg: float, size: int = 9) -> list[list[float]]:
    def mass(rate: float, goals: int) -> float:
        return math.exp(-rate) * rate**goals / math.factorial(goals)

    return [
        [mass(home_xg, h) * mass(away_xg, a) for a in range(size)] for h in range(size)
    ]


STRENGTH: dict[str, float] = {
    "attack": 70,
    "defence": 65,
    "midfield": 68,
    "goalkeeping": 66,
    "pace": 71,
    "finishing": 69,
    "possession": 64,
    "form": 2,
    "homeAdvantage": 60,
}


@dataclass
class FakeProbabilityModel:
    matrix: list[list[float]] = field(default_factory=lambda: poisson_matrix(1.6, 1.1))
    reachable: bool = True
    calls: int = 0

    async def calculate(
        self, home: TeamStrength, away: TeamStrength, request_id: str | None
    ) -> ProbabilityMatrix:
        self.calls += 1

        return ProbabilityMatrix(
            home_xg=1.6,
            away_xg=1.1,
            max_goals=len(self.matrix) - 1,
            score_matrix=self.matrix,
            model_version="test-model",
            configuration_version=1,
        )

    async def ping(self) -> None:
        if not self.reachable:
            raise RuntimeError("unreachable")


@dataclass
class FakeEventPublisher:
    fail: bool = False
    published: list[dict[str, Any]] = field(default_factory=list)

    async def publish_odds_updated(
        self, match_id: str, description: str, request_id: str | None
    ) -> None:
        if self.fail:
            raise RuntimeError("event service down")

        self.published.append({"matchId": match_id, "description": description})


@dataclass
class FakeAuditRecorder:
    fail: bool = False
    entries: list[AuditEntry] = field(default_factory=list)

    async def record(self, entry: AuditEntry) -> None:
        if self.fail:
            raise AuditUnavailableError

        self.entries.append(entry)


@dataclass
class FakeMatchDirectory:
    unknown: set[str] = field(default_factory=set)
    lifecycles: dict[str, str] = field(default_factory=dict)
    closes_in: dict[str, timedelta] = field(default_factory=dict)

    async def find(self, match_ids: list[str]) -> dict[str, MatchInfo]:
        return {
            match_id: MatchInfo(
                match_id=match_id,
                home_name="Lagos Lions",
                away_name="Abuja Tigers",
                home_short_name="LIO",
                away_short_name="TIG",
                league_name="Test League",
                lifecycle=self.lifecycles.get(match_id, "BETTING_OPEN"),
                betting_closes_at=datetime.now(UTC)
                + self.closes_in.get(match_id, timedelta(minutes=5)),
            )
            for match_id in match_ids
            if match_id not in self.unknown
        }


@dataclass
class FakeExposureReader:
    by_id: dict[str, SelectionExposure] = field(default_factory=dict)

    async def by_selection(self, market_ids: list[str]) -> dict[str, SelectionExposure]:
        return self.by_id


@dataclass
class Peers:
    probability_model: FakeProbabilityModel
    event_publisher: FakeEventPublisher
    audit_recorder: FakeAuditRecorder
    match_directory: FakeMatchDirectory
    exposure_reader: FakeExposureReader


@dataclass
class Harness:
    client: TestClient
    peers: Peers

    def rpc(self, procedure: str, payload: Any) -> dict[str, Any]:
        response = self.client.post(
            "/rpc",
            json={
                "id": str(uuid.uuid4()),
                "procedure": procedure,
                "payload": payload,
                "metadata": {"requestId": "trace-odds-test"},
                "timestamp": 0,
            },
            headers={"x-request-id": "trace-odds-test"},
        )
        assert response.status_code == 200

        return dict(response.json())

    def publish(self, match_id: str | None = None) -> str:
        resolved = match_id or str(uuid.uuid4())
        body = self.rpc(
            "odds.publishMarkets",
            {"matchId": resolved, "home": STRENGTH, "away": STRENGTH},
        )
        assert body["success"] is True, body

        return resolved


def build_settings() -> ServiceSettings:
    return ServiceSettings(
        service_name=SERVICE_NAME, version=SERVICE_VERSION, NODE_ENV="test"
    )


def admin_headers(*permissions: str, kind: str = "ADMIN") -> dict[str, str]:
    return {
        "x-betng-actor-kind": kind,
        "x-betng-actor-id": "0b0f6d3e-8a55-4a4e-9a57-3a1c1de0a001",
        "x-betng-actor-role": "TRADER",
        "x-betng-actor-name": "Test%20Trader",
        "x-betng-permissions": ",".join(permissions),
    }


@pytest.fixture
def database_url(monkeypatch: pytest.MonkeyPatch) -> str:
    url = integration_database_url()
    monkeypatch.setenv("ODDS_DATABASE_URL", url)

    return url


@pytest.fixture
def harness(database_url: str) -> Iterator[Harness]:
    peers = Peers(
        FakeProbabilityModel(),
        FakeEventPublisher(),
        FakeAuditRecorder(),
        FakeMatchDirectory(),
        FakeExposureReader(),
    )
    app = create_app(
        build_settings(),
        overrides=PeerOverrides(
            probability_model=peers.probability_model,
            event_publisher=peers.event_publisher,
            audit_recorder=peers.audit_recorder,
            match_directory=peers.match_directory,
            exposure_reader=peers.exposure_reader,
        ),
    )

    with TestClient(app, raise_server_exceptions=False) as client:
        yield Harness(client, peers)


@pytest.fixture
def database(database_url: str) -> Iterator[psycopg.Connection[dict[str, Any]]]:
    with psycopg.connect(database_url, row_factory=dict_row) as connection:
        yield connection
