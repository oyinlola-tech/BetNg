from __future__ import annotations

import time
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from betng_simulation.configs import SEED_VARIABLE_NAME
from betng_simulation.engine import (
    LEGACY_MODEL_VERSION,
    MODEL_VERSION,
    name_pool_for,
    squad_for,
)
from betng_simulation.errors import MatchNotSimulatedError
from betng_simulation.repositories import SimulationRepository, simulation_repository
from betng_simulation.services.simulation.queries import (
    ReplayMatchHandler,
    ReplayMatchQuery,
)

from .conftest import (
    AWAY_TEAM,
    HOME_TEAM,
    STRONG,
    WEAK,
    FakeAuditRecorder,
    FakeMatchReadModel,
    admin_headers,
    new_match_id,
    run_match_payload,
    running_client,
    strength_json,
)
from .test_persistence import build_handler, command
from .test_rpc import call

SECRET = "a-replay-seed-secret-of-at-least-32-characters"
CONFIG_URL = "/api/v1/admin/simulation/config"
OPERATE = admin_headers("simulation:read", "simulation:operate")


def replay(client: TestClient, match_id: str) -> dict[str, Any]:
    response = client.post(f"/internal/simulation/matches/{match_id}/replay")

    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


@pytest.fixture
def legacy_model(client: TestClient) -> Iterator[None]:
    switched = client.put(
        CONFIG_URL,
        json={"modelVersion": LEGACY_MODEL_VERSION, "reason": "replay the old model"},
        headers=OPERATE,
    )
    assert switched.status_code == 200, switched.text
    assert switched.json()["modelVersion"] == LEGACY_MODEL_VERSION

    try:
        yield
    finally:
        restored = client.put(
            CONFIG_URL,
            json={"modelVersion": MODEL_VERSION, "reason": "restore after test"},
            headers=OPERATE,
        )
        assert restored.status_code == 200


class TestReplay:
    def test_a_stored_run_replays_identically(self, client: TestClient) -> None:
        match_id = new_match_id()
        run = call(client, "simulation.runMatch", run_match_payload(match_id))["result"]
        body = replay(client, match_id)

        assert body == {
            "matchId": match_id,
            "simulationId": run["simulationId"],
            "modelVersion": MODEL_VERSION,
            "configurationVersion": run["configurationVersion"],
            "replayable": True,
            "identical": True,
            "seedVerified": None,
            "mismatches": [],
            "eventCount": run["eventCount"],
            "reason": None,
        }
        assert run["seed"] not in str(body)

    def test_a_keyed_run_verifies_its_seed_without_revealing_it(
        self,
        monkeypatch: pytest.MonkeyPatch,
        audit: FakeAuditRecorder,
        matches: FakeMatchReadModel,
    ) -> None:
        monkeypatch.setenv(SEED_VARIABLE_NAME, SECRET)
        match_id = new_match_id()

        with running_client(audit, matches) as client:
            run = call(client, "simulation.runMatch", run_match_payload(match_id))
            body = call(client, "simulation.replayMatch", {"matchId": match_id})

        assert body["success"] is True
        assert body["result"]["identical"] is True
        assert body["result"]["seedVerified"] is True
        assert run["result"]["seed"] not in str(body)
        assert SECRET not in str(body)

    def test_a_legacy_run_replays_under_its_own_model(
        self, client: TestClient, legacy_model: None
    ) -> None:
        match_id = new_match_id()
        run = call(client, "simulation.runMatch", run_match_payload(match_id))["result"]
        events = client.get(f"/internal/simulation/matches/{match_id}/events").json()
        squads = call(
            client,
            "simulation.getSquads",
            {
                "home": {"teamId": HOME_TEAM.team_id, "name": HOME_TEAM.name},
                "away": {"teamId": AWAY_TEAM.team_id, "name": AWAY_TEAM.name},
            },
        )["result"]
        body = replay(client, match_id)

        assert run["modelVersion"] == LEGACY_MODEL_VERSION
        assert body["identical"] is True
        assert body["modelVersion"] == LEGACY_MODEL_VERSION
        named = {
            player["name"]
            for side in ("home", "away")
            for group in ("starting", "substitutes")
            for player in squads[side][group]
        }
        assert all(
            event["player"] in named for event in events["items"] if "player" in event
        )
        legacy_pool = name_pool_for(LEGACY_MODEL_VERSION)
        assert squads["home"]["starting"][0]["name"] == (
            squad_for(HOME_TEAM.team_id, legacy_pool).starters[0].name
        )

    def test_a_replay_of_an_unplayed_match_is_not_found(
        self, client: TestClient
    ) -> None:
        response = client.post(f"/internal/simulation/matches/{new_match_id()}/replay")

        assert response.status_code == 404

    async def test_a_run_without_recorded_inputs_is_not_replayable(
        self,
        repository: SimulationRepository,
        audit: FakeAuditRecorder,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        handler, auditor = build_handler(repository, audit)
        match_id = new_match_id()
        with monkeypatch.context() as patch:
            patch.setattr(simulation_repository, "inputs_to_json", lambda _h, _a: None)
            await handler.execute(command(match_id))
        await auditor.drain()

        body = await ReplayMatchHandler(repository, None).execute(
            ReplayMatchQuery(match_id)
        )

        assert body.replayable is False
        assert body.identical is None
        assert body.reason is not None

        with pytest.raises(MatchNotSimulatedError):
            await ReplayMatchHandler(repository, None).execute(
                ReplayMatchQuery(new_match_id())
            )


class TestPricing:
    def test_pricing_uses_the_model_that_will_play_the_match(
        self, client: TestClient
    ) -> None:
        match_id = new_match_id()
        payload = {
            "matchId": match_id,
            "home": strength_json(STRONG),
            "away": strength_json(WEAK),
        }
        started = time.perf_counter()
        first = call(client, "simulation.calculateProbabilities", payload)["result"]
        cold = time.perf_counter() - started
        started = time.perf_counter()
        second = call(client, "simulation.calculateProbabilities", payload)["result"]
        warm = time.perf_counter() - started
        run = call(client, "simulation.runMatch", run_match_payload(match_id))["result"]

        assert first == second
        assert warm < cold
        assert first["modelVersion"] == run["modelVersion"] == MODEL_VERSION
        assert first["configurationVersion"] == run["configurationVersion"]
        assert sum(sum(row) for row in first["scoreMatrix"]) == pytest.approx(1.0)
        assert len(first["scoreMatrix"]) == first["maxGoals"] + 1

    def test_each_match_has_its_own_pricing_stream(self, client: TestClient) -> None:
        def price(match_id: str | None) -> dict[str, Any]:
            payload: dict[str, Any] = {
                "home": strength_json(STRONG),
                "away": strength_json(WEAK),
            }
            if match_id is not None:
                payload["matchId"] = match_id
            result: dict[str, Any] = call(
                client, "simulation.calculateProbabilities", payload
            )["result"]
            return result

        assert (
            price(new_match_id())["scoreMatrix"] != price(new_match_id())["scoreMatrix"]
        )
        assert price(None)["scoreMatrix"] == price(None)["scoreMatrix"]

    def test_the_legacy_model_is_priced_analytically(
        self, client: TestClient, legacy_model: None
    ) -> None:
        result = call(
            client,
            "simulation.calculateProbabilities",
            {
                "matchId": new_match_id(),
                "home": strength_json(STRONG),
                "away": strength_json(WEAK),
            },
        )["result"]

        assert result["modelVersion"] == LEGACY_MODEL_VERSION
        assert result["maxGoals"] == 8
        assert all(cell > 0 for row in result["scoreMatrix"] for cell in row)


class TestModelSelection:
    def test_an_unknown_model_version_is_refused(self, client: TestClient) -> None:
        response = client.put(
            CONFIG_URL,
            json={"modelVersion": "poisson-9.9", "reason": "not a model"},
            headers=OPERATE,
        )

        assert response.status_code == 422

    def test_the_active_model_is_the_progressive_one(self, client: TestClient) -> None:
        config = client.get(CONFIG_URL, headers=OPERATE).json()

        assert config["modelVersion"] == MODEL_VERSION
        assert config["params"]["weatherEnabled"] is False
        assert config["params"]["fatigueEnabled"] is False
        assert config["params"]["pricingSimulations"] >= 1000
