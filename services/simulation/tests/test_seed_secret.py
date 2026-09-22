from __future__ import annotations

import hashlib
import hmac
import logging
from collections.abc import Iterator

import pytest
from betng_service_kit import ServiceSettings
from fastapi.testclient import TestClient

from betng_simulation.app import create_app
from betng_simulation.configs import (
    SEED_SECRET_PLACEHOLDER,
    SEED_VARIABLE_NAME,
    SERVICE_NAME,
    SERVICE_VERSION,
    load_seed_secret,
)
from betng_simulation.engine import (
    ModelConfiguration,
    derive_seed,
    seed_material,
    simulate,
)
from betng_simulation.repositories import SimulationRepository

from .conftest import (
    AWAY_TEAM,
    HOME_TEAM,
    FakeAuditRecorder,
    FakeMatchReadModel,
    admin_headers,
    new_match_id,
    run_match_payload,
    running_client,
)
from .test_persistence import build_handler, command

MATCH_ID = "88888888-8888-4888-8888-888888888888"
CONFIGURATION = ModelConfiguration()
SECRET = "a-test-seed-secret-of-at-least-32-characters"
OTHER_SECRET = "another-seed-secret-of-at-least-32-characters"


class CapturingHandler(logging.Handler):
    def __init__(self) -> None:
        super().__init__(logging.DEBUG)
        self.records: list[logging.LogRecord] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.records.append(record)

    def text(self) -> str:
        return "\n".join(str(record.__dict__) for record in self.records)


@pytest.fixture
def service_log() -> Iterator[CapturingHandler]:
    # The kit replaces the root handlers at start-up, which drops caplog's.
    handler = CapturingHandler()
    logger = logging.getLogger(SERVICE_NAME)
    logger.addHandler(handler)
    try:
        yield handler
    finally:
        logger.removeHandler(handler)


class TestKeyedSeed:
    def test_the_seed_is_the_hmac_of_the_material(self) -> None:
        material = seed_material(MATCH_ID, "poisson-1.0", 1)

        assert material == f"{MATCH_ID}:poisson-1.0:1"
        assert derive_seed(MATCH_ID, "poisson-1.0", 1, SECRET) == (
            hmac.new(SECRET.encode(), material.encode(), hashlib.sha256).hexdigest()
        )

    def test_same_inputs_and_secret_replay_the_same_match(self) -> None:
        first = simulate(MATCH_ID, HOME_TEAM, AWAY_TEAM, CONFIGURATION, SECRET)
        second = simulate(MATCH_ID, HOME_TEAM, AWAY_TEAM, CONFIGURATION, SECRET)

        assert first == second
        assert first.result.seed == derive_seed(
            MATCH_ID, CONFIGURATION.model_version, 1, SECRET
        )

    def test_a_different_secret_gives_a_different_seed(self) -> None:
        assert derive_seed(MATCH_ID, "poisson-1.0", 1, SECRET) != derive_seed(
            MATCH_ID, "poisson-1.0", 1, OTHER_SECRET
        )

    def test_public_inputs_alone_do_not_give_the_seed(self) -> None:
        material = seed_material(MATCH_ID, "poisson-1.0", 1)
        public_guess = hashlib.sha256(material.encode()).hexdigest()
        keyed = [
            simulate(match_id, HOME_TEAM, AWAY_TEAM, CONFIGURATION, SECRET)
            for match_id in (f"{MATCH_ID[:-3]}{index:03d}" for index in range(200))
        ]
        unkeyed = [
            simulate(output.result.match_id, HOME_TEAM, AWAY_TEAM, CONFIGURATION)
            for output in keyed
        ]

        assert derive_seed(MATCH_ID, "poisson-1.0", 1, SECRET) != public_guess
        assert all(
            a.result.seed != b.result.seed for a, b in zip(keyed, unkeyed, strict=True)
        )
        assert [a.result for a in keyed] != [b.result for b in unkeyed]

    def test_without_a_secret_the_fallback_is_plain_sha256(self) -> None:
        material = seed_material(MATCH_ID, "poisson-1.0", 1)

        assert derive_seed(MATCH_ID, "poisson-1.0", 1) == (
            hashlib.sha256(material.encode()).hexdigest()
        )


class TestSecretConfiguration:
    def test_development_may_run_without_a_secret(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv(SEED_VARIABLE_NAME, raising=False)

        assert load_seed_secret("development") is None
        assert load_seed_secret("test") is None

    @pytest.mark.parametrize("value", [None, "", "short", "x" * 31])
    def test_production_refuses_a_missing_or_short_secret(
        self, monkeypatch: pytest.MonkeyPatch, value: str | None
    ) -> None:
        if value is None:
            monkeypatch.delenv(SEED_VARIABLE_NAME, raising=False)
        else:
            monkeypatch.setenv(SEED_VARIABLE_NAME, value)

        with pytest.raises(ValueError) as raised:
            load_seed_secret("production")

        assert value is None or value == "" or value not in str(raised.value)

    def test_production_refuses_the_placeholder(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        assert len(SEED_SECRET_PLACEHOLDER) >= 32
        monkeypatch.setenv(SEED_VARIABLE_NAME, SEED_SECRET_PLACEHOLDER)

        with pytest.raises(ValueError):
            load_seed_secret("production")

    def test_production_accepts_a_strong_secret(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv(SEED_VARIABLE_NAME, SECRET)

        assert load_seed_secret("production") == SECRET

    def test_the_app_refuses_to_start_in_production_without_one(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv(SEED_VARIABLE_NAME, raising=False)
        settings = ServiceSettings(
            service_name=SERVICE_NAME, version=SERVICE_VERSION, NODE_ENV="production"
        )

        with pytest.raises(ValueError):
            create_app(settings)

    def test_a_missing_secret_is_warned_about_once_at_startup(
        self,
        audit: FakeAuditRecorder,
        matches: FakeMatchReadModel,
        service_log: CapturingHandler,
    ) -> None:
        with running_client(audit, matches) as client:
            client.get("/health")
            client.get("/health")

        warnings = [
            record
            for record in service_log.records
            if getattr(record, "event", None) == "seed_secret_missing"
        ]
        assert len(warnings) == 1


class TestSecretNeverLeaks:
    def test_a_keyed_run_stores_the_seed_and_material_but_not_the_key(
        self,
        monkeypatch: pytest.MonkeyPatch,
        audit: FakeAuditRecorder,
        matches: FakeMatchReadModel,
        service_log: CapturingHandler,
    ) -> None:
        monkeypatch.setenv(SEED_VARIABLE_NAME, SECRET)
        match_id = new_match_id()
        payload = run_match_payload(match_id)
        del payload["matchId"]

        with running_client(audit, matches) as client:
            created = client.post(
                f"/internal/simulation/matches/{match_id}/run", json=payload
            )
            detail = client.get(f"/internal/simulation/matches/{match_id}")
            config = client.get(
                "/api/v1/admin/simulation/config",
                headers=admin_headers("simulation:read"),
            )
            listing = client.get(
                "/api/v1/admin/simulations?limit=200",
                headers=admin_headers("simulation:read"),
            )

        body = created.json()
        version = body["configurationVersion"]
        model = body["modelVersion"]
        assert body["seed"] == derive_seed(match_id, model, version, SECRET)
        assert body["seed"] != derive_seed(match_id, model, version)
        assert any(
            getattr(record, "event", None) == "simulation_completed"
            for record in service_log.records
        )
        assert not any(
            getattr(record, "event", None) == "seed_secret_missing"
            for record in service_log.records
        )

        for text in (
            created.text,
            detail.text,
            config.text,
            listing.text,
            service_log.text(),
            str(audit.entries),
        ):
            assert SECRET not in text

    async def test_the_material_is_stored_unkeyed(
        self, repository: SimulationRepository, audit: FakeAuditRecorder
    ) -> None:
        handler, _ = build_handler(repository, audit, seed_secret=SECRET)
        match_id = new_match_id()
        response = await handler.execute(command(match_id))

        async with repository.transaction() as connection:
            cursor = await connection.execute(
                "SELECT seed, seed_material FROM simulation.simulation_runs "
                "WHERE id = %s",
                (str(response.simulation_id),),
            )
            row = await cursor.fetchone()
            leaked = await connection.execute(
                "SELECT count(*) AS n FROM simulation.simulation_runs "
                "WHERE position(%s in to_jsonb(simulation_runs)::text) > 0",
                (SECRET,),
            )
            leak_row = await leaked.fetchone()

        assert row is not None
        assert leak_row is not None
        assert row["seed_material"] == seed_material(
            match_id, response.model_version, response.configuration_version
        )
        assert row["seed"] == response.seed
        assert row["seed"] != hashlib.sha256(row["seed_material"].encode()).hexdigest()
        assert leak_row["n"] == 0

    def test_no_seed_exists_before_the_run(self, client: TestClient) -> None:
        match_id = new_match_id()

        assert client.get(f"/internal/simulation/matches/{match_id}").status_code == 404
        listing = client.get(
            "/api/v1/admin/simulations?limit=200",
            headers=admin_headers("simulation:read"),
        )
        assert match_id not in listing.text
