"""The odds service starts, serves and reports its own state."""

from __future__ import annotations

from betng_service_kit import ServiceSettings
from fastapi.testclient import TestClient

from betng_odds.app import create_app
from betng_odds.configs import SERVICE_NAME, SERVICE_VERSION


def build_client() -> TestClient:
    settings = ServiceSettings(
        service_name=SERVICE_NAME, version=SERVICE_VERSION, NODE_ENV="test"
    )
    return TestClient(create_app(settings))


class TestHealth:
    def test_reports_ok_with_service_identity(self) -> None:
        response = build_client().get("/health")

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "ok"
        assert body["service"] == SERVICE_NAME
        assert body["version"] == SERVICE_VERSION

    def test_echoes_a_supplied_request_id(self) -> None:
        response = build_client().get(
            "/health", headers={"x-request-id": "trace-odds-0001"}
        )

        assert response.headers["x-request-id"] == "trace-odds-0001"


class TestReadiness:
    def test_reports_no_dependencies_because_it_has_none(self) -> None:
        response = build_client().get("/ready")

        assert response.status_code == 200
        assert response.json()["dependencies"] == []
