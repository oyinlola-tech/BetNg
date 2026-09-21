from __future__ import annotations

import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient

from betng_simulation.engine import simulate
from betng_simulation.utils import build_configuration

from .conftest import (
    AWAY_TEAM,
    HOME_TEAM,
    STRONG,
    WEAK,
    FakeAuditRecorder,
    FakeMatchReadModel,
    admin_headers,
    failing_simulate,
    new_match_id,
    run_match_payload,
    running_client,
    strength_json,
)


def call(client: TestClient, procedure: str, payload: Any) -> dict[str, Any]:
    response = client.post(
        "/rpc",
        json={
            "id": str(uuid.uuid4()),
            "procedure": procedure,
            "payload": payload,
            "metadata": {"requestId": "rpc-test-0001"},
            "timestamp": 0,
        },
        headers={"x-request-id": "rpc-test-0001"},
    )

    assert response.status_code == 200
    body: dict[str, Any] = response.json()
    return body


class TestRunMatch:
    def test_returns_the_contract_shape(self, client: TestClient) -> None:
        match_id = new_match_id()
        body = call(client, "simulation.runMatch", run_match_payload(match_id))

        assert body["success"] is True
        result = body["result"]
        assert set(result) == {
            "simulationId",
            "matchId",
            "status",
            "duplicate",
            "modelVersion",
            "configurationVersion",
            "seed",
            "result",
            "eventCount",
        }
        assert set(result["result"]) == {
            "homeGoals",
            "awayGoals",
            "winner",
            "winningGap",
        }
        assert result["matchId"] == match_id
        assert result["status"] == "COMPLETED"
        assert result["duplicate"] is False
        assert result["modelVersion"] == "poisson-1.0"
        assert len(result["seed"]) == 64
        assert result["result"]["winningGap"] == abs(
            result["result"]["homeGoals"] - result["result"]["awayGoals"]
        )
        assert result["eventCount"] >= 4

    def test_a_second_call_returns_the_stored_run(self, client: TestClient) -> None:
        payload = run_match_payload(new_match_id())
        first = call(client, "simulation.runMatch", payload)["result"]
        second = call(client, "simulation.runMatch", payload)["result"]

        assert second == {**first, "duplicate": True}

    def test_lifecycle_audits_are_written_without_the_score(
        self, audit: FakeAuditRecorder, matches: FakeMatchReadModel
    ) -> None:
        with running_client(audit, matches) as client:
            call(client, "simulation.runMatch", run_match_payload(new_match_id()))

        assert audit.actions() == ["simulation_started", "simulation_completed"]
        for entry in audit.entries:
            assert (entry.actor_id, entry.actor_role) == ("system", "SYSTEM")
            assert entry.request_id == "rpc-test-0001"
            assert "homeGoals" not in str(entry.after)
            assert "winner" not in str(entry.after)

    @pytest.mark.parametrize(
        "extra",
        [
            {"totalBetAmount": 1150},
            {"stakes": {"HOME": 1000, "AWAY": 100, "DRAW": 50}},
            {"userId": "33333333-3333-4333-8333-333333333333"},
            {"shopId": "33333333-3333-4333-8333-333333333334"},
            {"seed": 7},
        ],
    )
    def test_a_payload_with_bet_data_is_a_validation_error(
        self, client: TestClient, extra: dict[str, Any]
    ) -> None:
        match_id = new_match_id()
        body = call(
            client, "simulation.runMatch", {**run_match_payload(match_id), **extra}
        )

        assert body["success"] is False
        assert body["error"]["code"] == "RPC_VALIDATION_ERROR"

        untouched = client.get(f"/internal/simulation/matches/{match_id}")
        assert untouched.status_code == 404

    def test_the_stored_result_is_the_engines_alone(self, client: TestClient) -> None:
        match_id = new_match_id()
        config = client.get(
            "/api/v1/admin/simulation/config", headers=admin_headers("simulation:read")
        ).json()
        result = call(client, "simulation.runMatch", run_match_payload(match_id))
        expected = simulate(
            match_id,
            HOME_TEAM,
            AWAY_TEAM,
            build_configuration(
                config["version"], config["modelVersion"], config["params"]
            ),
        ).result

        assert result["result"]["result"] == {
            "homeGoals": expected.home_goals,
            "awayGoals": expected.away_goals,
            "winner": expected.winner,
            "winningGap": expected.winning_gap,
        }

    def test_rejects_out_of_range_strength(self, client: TestClient) -> None:
        payload = run_match_payload(new_match_id())
        payload["home"]["strength"]["attack"] = 500

        body = call(client, "simulation.runMatch", payload)

        assert body["error"]["code"] == "RPC_VALIDATION_ERROR"
        assert any(
            detail["path"] == "home.strength.attack"
            for detail in body["error"]["details"]
        )

    def test_a_failed_simulation_is_reported_as_failed(
        self, audit: FakeAuditRecorder, matches: FakeMatchReadModel
    ) -> None:
        with running_client(audit, matches, failing_simulate) as client:
            body = call(
                client, "simulation.runMatch", run_match_payload(new_match_id())
            )

        assert body["success"] is False
        assert body["error"]["code"] == "SIMULATION_FAILED"
        assert "engine was made to fail" not in body["error"]["message"]
        assert audit.actions() == ["simulation_started", "simulation_failed"]

    def test_the_old_procedure_is_gone(self, client: TestClient) -> None:
        body = call(
            client, "simulation.generateMatch", run_match_payload(new_match_id())
        )

        assert body["error"]["code"] == "RPC_PROCEDURE_NOT_FOUND"


class TestCalculateProbabilities:
    def test_returns_a_normalised_score_matrix(self, client: TestClient) -> None:
        body = call(
            client,
            "simulation.calculateProbabilities",
            {"home": strength_json(STRONG), "away": strength_json(WEAK)},
        )

        assert body["success"] is True
        result = body["result"]
        assert set(result) == {
            "homeXg",
            "awayXg",
            "maxGoals",
            "scoreMatrix",
            "modelVersion",
            "configurationVersion",
        }
        assert len(result["scoreMatrix"]) == result["maxGoals"] + 1
        assert sum(sum(row) for row in result["scoreMatrix"]) == pytest.approx(1.0)
        assert result["homeXg"] > result["awayXg"]

    def test_rejects_unknown_fields(self, client: TestClient) -> None:
        body = call(
            client,
            "simulation.calculateProbabilities",
            {
                "home": strength_json(STRONG),
                "away": strength_json(WEAK),
                "exposure": {"HOME": 1000},
            },
        )

        assert body["error"]["code"] == "RPC_VALIDATION_ERROR"
