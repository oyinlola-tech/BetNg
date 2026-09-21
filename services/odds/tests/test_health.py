from __future__ import annotations

from fastapi.testclient import TestClient

from betng_odds import create_app
from betng_odds.configs import SERVICE_NAME, SERVICE_VERSION
from conftest import Harness, build_settings


class TestHealth:
    def test_reports_ok_with_service_identity(self, database_url: str) -> None:
        response = TestClient(create_app(build_settings())).get("/health")

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "ok"
        assert body["service"] == SERVICE_NAME
        assert body["version"] == SERVICE_VERSION

    def test_echoes_a_supplied_request_id(self, harness: Harness) -> None:
        response = harness.client.get(
            "/health", headers={"x-request-id": "trace-odds-0001"}
        )

        assert response.headers["x-request-id"] == "trace-odds-0001"


class TestReadiness:
    def test_probes_the_database_and_the_simulation_service(
        self, harness: Harness
    ) -> None:
        response = harness.client.get("/ready")

        assert response.status_code == 200
        assert {d["name"]: d["status"] for d in response.json()["dependencies"]} == {
            "postgres": "ok",
            "simulation": "ok",
        }

    def test_is_unavailable_without_the_simulation_service(
        self, harness: Harness
    ) -> None:
        harness.peers.probability_model.reachable = False
        response = harness.client.get("/ready")

        assert response.status_code == 503
        statuses = {d["name"]: d["status"] for d in response.json()["dependencies"]}
        assert statuses == {"postgres": "ok", "simulation": "unavailable"}

    def test_is_unavailable_without_the_database(self, database_url: str) -> None:
        # No lifespan: the pool was never opened, as when PostgreSQL is down.
        response = TestClient(create_app(build_settings())).get("/ready")

        assert response.status_code == 503
