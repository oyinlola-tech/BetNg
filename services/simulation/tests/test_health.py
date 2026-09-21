from __future__ import annotations

from fastapi.testclient import TestClient

from betng_simulation.configs import SERVICE_NAME, SERVICE_VERSION


class TestHealth:
    def test_reports_ok_with_service_identity(self, client: TestClient) -> None:
        response = client.get("/health")

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "ok"
        assert body["service"] == SERVICE_NAME
        assert body["version"] == SERVICE_VERSION

    def test_echoes_a_supplied_request_id(self, client: TestClient) -> None:
        response = client.get("/health", headers={"x-request-id": "trace-health-0001"})

        assert response.headers["x-request-id"] == "trace-health-0001"


class TestReadiness:
    def test_probes_the_database(self, client: TestClient) -> None:
        response = client.get("/ready")

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "ok"
        assert [entry["name"] for entry in body["dependencies"]] == ["postgres"]
        assert body["dependencies"][0]["status"] == "ok"
