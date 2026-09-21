from __future__ import annotations

from betng_service_kit import ServiceSettings
from fastapi.testclient import TestClient

from betng_risk.app import create_app
from betng_risk.configs import SERVICE_NAME, SERVICE_VERSION


class TestHealth:
    def test_reports_ok_with_service_identity(self, client: TestClient) -> None:
        response = client.get("/health")

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "ok"
        assert body["service"] == SERVICE_NAME

    def test_echoes_a_supplied_request_id(self, client: TestClient) -> None:
        response = client.get("/health", headers={"x-request-id": "trace-risk-0001"})

        assert response.headers["x-request-id"] == "trace-risk-0001"


class TestReadiness:
    def test_probes_the_database(self, client: TestClient) -> None:
        response = client.get("/ready")

        assert response.status_code == 200
        (dependency,) = response.json()["dependencies"]
        assert dependency["name"] == "postgres"
        assert dependency["status"] == "ok"

    def test_is_unavailable_when_the_database_cannot_be_queried(self) -> None:
        settings = ServiceSettings(
            service_name=SERVICE_NAME, version=SERVICE_VERSION, NODE_ENV="test"
        )
        # No lifespan: the pool is never opened, as when PostgreSQL is down.
        response = TestClient(create_app(settings)).get("/ready")

        assert response.status_code == 503
        assert response.json()["dependencies"][0]["status"] == "unavailable"
