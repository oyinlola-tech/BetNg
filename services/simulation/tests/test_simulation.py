from __future__ import annotations

from betng_service_kit import ServiceSettings
from fastapi.testclient import TestClient

from betng_simulation.app import create_app
from betng_simulation.configs import SERVICE_NAME, SERVICE_VERSION

MATCH_ID = "44444444-4444-4444-8444-444444444444"
HOME = {
    "id": "22222222-2222-4222-8222-222222222221",
    "name": "Lagos Lions",
    "strength": 72,
}
AWAY = {
    "id": "22222222-2222-4222-8222-222222222222",
    "name": "Abuja Eagles",
    "strength": 68,
}


def build_client() -> TestClient:
    settings = ServiceSettings(
        service_name=SERVICE_NAME, version=SERVICE_VERSION, NODE_ENV="test"
    )
    return TestClient(create_app(settings), raise_server_exceptions=False)


class TestRunSimulation:
    def test_refuses_with_501_until_the_engine_is_built(self) -> None:
        response = build_client().post(
            "/api/v1/simulations",
            json={"matchId": MATCH_ID, "homeTeam": HOME, "awayTeam": AWAY},
        )

        # The contract and the route are fixed; the engine is not built. A 501
        # says so, rather than returning a score that means nothing.
        assert response.status_code == 501
        error = response.json()["error"]
        assert error["code"] == "NOT_IMPLEMENTED"
        assert "requestId" in error

    def test_rejects_a_body_that_breaks_the_contract(self) -> None:
        response = build_client().post(
            "/api/v1/simulations",
            json={
                "matchId": MATCH_ID,
                "homeTeam": {**HOME, "strength": 500},
                "awayTeam": AWAY,
            },
        )

        assert response.status_code == 422
        error = response.json()["error"]
        assert error["code"] == "VALIDATION_FAILED"
        assert any(
            detail["path"] == "homeTeam.strength" for detail in error["details"]
        )

    def test_rejects_a_body_missing_a_required_field(self) -> None:
        response = build_client().post(
            "/api/v1/simulations", json={"matchId": MATCH_ID, "homeTeam": HOME}
        )

        assert response.status_code == 422
        assert response.json()["error"]["code"] == "VALIDATION_FAILED"


class TestProbabilities:
    def test_refuses_with_501_until_the_engine_is_built(self) -> None:
        response = build_client().post(
            "/api/v1/probabilities",
            json={"matchId": MATCH_ID, "homeTeam": HOME, "awayTeam": AWAY},
        )

        assert response.status_code == 501
        assert response.json()["error"]["code"] == "NOT_IMPLEMENTED"


class TestUnknownRoute:
    def test_answers_the_shared_error_envelope(self) -> None:
        response = build_client().get("/api/v1/nope")

        assert response.status_code == 404
        error = response.json()["error"]
        assert error["code"] == "NOT_FOUND"
        assert "requestId" in error
