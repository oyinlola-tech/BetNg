from __future__ import annotations

from typing import Any

from betng_service_kit import ServiceSettings
from fastapi.testclient import TestClient

from betng_odds.app import create_app
from betng_odds.configs import SERVICE_NAME, SERVICE_VERSION

MATCH_ID = "44444444-4444-4444-8444-444444444444"
PROBABILITIES = {
    "matchId": MATCH_ID,
    "homeWin": 0.45,
    "draw": 0.28,
    "awayWin": 0.27,
}


def build_client() -> TestClient:
    settings = ServiceSettings(
        service_name=SERVICE_NAME, version=SERVICE_VERSION, NODE_ENV="test"
    )
    return TestClient(create_app(settings), raise_server_exceptions=False)


def rpc(procedure: str, payload: Any) -> dict[str, Any]:
    frame = {
        "id": "rpc-test-1",
        "procedure": procedure,
        "payload": payload,
        "metadata": {"requestId": "trace-odds-rpc-0001"},
        "timestamp": 0,
    }
    response = build_client().post("/rpc", json=frame)
    assert response.status_code == 200
    return dict(response.json())


class TestCalculateOdds:
    def test_refuses_with_a_typed_code_until_pricing_is_built(self) -> None:
        body = rpc(
            "odds.calculateOdds",
            {"matchId": MATCH_ID, "probabilities": PROBABILITIES},
        )

        # The procedure and its payload are fixed; the pricing model is not
        # built. The refusal keeps its own code across the wire rather than
        # being flattened into a generic internal error.
        assert body["success"] is False
        assert body["error"]["code"] == "NOT_IMPLEMENTED"

    def test_rejects_a_payload_that_breaks_the_contract(self) -> None:
        body = rpc(
            "odds.calculateOdds",
            {
                "matchId": MATCH_ID,
                "probabilities": {**PROBABILITIES, "homeWin": 5},
            },
        )

        assert body["success"] is False
        assert body["error"]["code"] == "RPC_VALIDATION_ERROR"
        assert any(
            detail["path"] == "probabilities.homeWin"
            for detail in body["error"]["details"]
        )


class TestUnknownProcedure:
    def test_is_reported_rather_than_silently_ignored(self) -> None:
        body = rpc("odds.nope", {})

        assert body["success"] is False
        assert body["error"]["code"] == "RPC_PROCEDURE_NOT_FOUND"


class TestRestSecondaryDoor:
    def test_reaches_the_same_handler_as_rpc(self) -> None:
        response = build_client().get(f"/api/v1/matches/{MATCH_ID}/odds")

        # Same refusal, same code: one implementation behind two doors.
        assert response.status_code == 501
        assert response.json()["error"]["code"] == "NOT_IMPLEMENTED"
