from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from betng_simulation.interfaces import MatchView

from .conftest import (
    FakeAuditRecorder,
    FakeMatchReadModel,
    admin_headers,
    failing_simulate,
    new_match_id,
    run_match_payload,
    running_client,
)

READ = "simulation:read"
OPERATE = "simulation:operate"
INTERNAL_TOKEN = "test-internal-token-0123456789abcdef"


def run_body(match_id: str) -> dict[str, Any]:
    payload = run_match_payload(match_id)
    del payload["matchId"]
    return payload


def run(client: TestClient, match_id: str) -> dict[str, Any]:
    response = client.post(
        f"/internal/simulation/matches/{match_id}/run", json=run_body(match_id)
    )
    assert response.status_code == 200
    body: dict[str, Any] = response.json()
    return body


def find_run(client: TestClient, match_id: str, **params: str) -> dict[str, Any] | None:
    response = client.get(
        "/api/v1/admin/simulations",
        params={"limit": "200", **params},
        headers=admin_headers(READ),
    )
    assert response.status_code == 200
    items: list[dict[str, Any]] = response.json()["items"]
    return next((item for item in items if item["matchId"] == match_id), None)


class TestInternalRoutes:
    def test_run_then_read_the_run_and_its_events(self, client: TestClient) -> None:
        match_id = new_match_id()
        created = run(client, match_id)
        again = run(client, match_id)

        assert created["duplicate"] is False
        assert again == {**created, "duplicate": True}

        detail = client.get(f"/internal/simulation/matches/{match_id}").json()
        assert detail["run"]["id"] == created["simulationId"]
        assert detail["run"]["status"] == "COMPLETED"
        assert detail["run"]["startedAt"].endswith("Z")
        assert detail["result"]["homeGoals"] == created["result"]["homeGoals"]
        assert detail["result"]["stats"]["asOfMinute"] == 90

        events = client.get(f"/internal/simulation/matches/{match_id}/events").json()[
            "items"
        ]
        assert len(events) == created["eventCount"]
        assert events[0]["type"] == "KICK_OFF"
        assert "side" not in events[0]
        assert events[-1]["score"] == {
            "home": created["result"]["homeGoals"],
            "away": created["result"]["awayGoals"],
        }

    def test_bet_data_in_the_body_is_rejected(self, client: TestClient) -> None:
        match_id = new_match_id()
        response = client.post(
            f"/internal/simulation/matches/{match_id}/run",
            json={**run_body(match_id), "totalBetAmount": 1150},
        )

        assert response.status_code == 422
        assert response.json()["error"]["code"] == "VALIDATION_FAILED"

    def test_an_unknown_match_is_404(self, client: TestClient) -> None:
        for path in ("", "/events"):
            response = client.get(
                f"/internal/simulation/matches/{new_match_id()}{path}"
            )
            assert response.status_code == 404
            assert response.json()["error"]["code"] == "NOT_FOUND"

    def test_a_malformed_match_id_is_rejected(self, client: TestClient) -> None:
        response = client.get("/internal/simulation/matches/not-a-uuid")

        assert response.status_code == 422

    def test_the_internal_token_is_required_when_configured(
        self,
        monkeypatch: pytest.MonkeyPatch,
        audit: FakeAuditRecorder,
        matches: FakeMatchReadModel,
    ) -> None:
        match_id = new_match_id()

        with running_client(audit, matches) as client:
            run(client, match_id)
            monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", INTERNAL_TOKEN)

            for path in ("", "/events"):
                url = f"/internal/simulation/matches/{match_id}{path}"

                assert client.get(url).status_code == 404
                assert (
                    client.get(
                        url, headers={"x-betng-internal-token": "wrong"}
                    ).status_code
                    == 404
                )
                assert (
                    client.get(
                        url, headers={"x-betng-internal-token": INTERNAL_TOKEN}
                    ).status_code
                    == 200
                )

            outsider = client.post(
                f"/internal/simulation/matches/{new_match_id()}/run",
                json=run_body(match_id),
            )
            assert outsider.status_code == 404

    def test_the_old_public_routes_are_gone(self, client: TestClient) -> None:
        for path in ("/api/v1/simulations", "/api/v1/probabilities"):
            assert client.post(path, json={}).status_code == 404


class TestAdminPermissions:
    @pytest.mark.parametrize(
        ("method", "path", "permission", "body"),
        [
            ("GET", "/api/v1/admin/simulations", READ, None),
            ("GET", "/api/v1/admin/simulation/config", READ, None),
            ("PUT", "/api/v1/admin/simulation/config", OPERATE, {"reason": "x" * 5}),
            (
                "POST",
                "/api/v1/admin/simulations/11111111-1111-4111-8111-111111111111/actions",
                OPERATE,
                {"action": "RETRY", "reason": "retry it"},
            ),
        ],
    )
    def test_every_admin_route_checks_the_actor(
        self,
        client: TestClient,
        method: str,
        path: str,
        permission: str,
        body: dict[str, Any] | None,
    ) -> None:
        anonymous = client.request(method, path, json=body)
        assert anonymous.status_code == 401
        assert anonymous.json()["error"]["code"] == "UNAUTHENTICATED"

        other = READ if permission == OPERATE else "odds:read"
        unprivileged = client.request(
            method, path, json=body, headers=admin_headers(other)
        )
        assert unprivileged.status_code == 403
        assert unprivileged.json()["error"]["code"] == "FORBIDDEN"

        customer = client.request(
            method, path, json=body, headers=admin_headers(permission, kind="CUSTOMER")
        )
        assert customer.status_code == 403

    def test_authorisation_comes_before_body_validation(
        self, client: TestClient
    ) -> None:
        response = client.put("/api/v1/admin/simulation/config", json={"bogus": 1})

        assert response.status_code == 401


class TestResultSecrecy:
    def test_the_score_is_withheld_until_the_match_is_completed(
        self, client: TestClient, matches: FakeMatchReadModel
    ) -> None:
        match_id = new_match_id()
        created = run(client, match_id)

        unknown = find_run(client, match_id)
        assert unknown is not None
        assert unknown["score"] is None
        assert unknown["seed"] is None

        for status in ("BETTING_CLOSED", "IN_PLAY", "CANCELLED"):
            matches.matches[match_id] = MatchView(status, "Premier Division")
            hidden = find_run(client, match_id)

            assert hidden is not None
            assert hidden["score"] is None
            assert hidden["seed"] is None
            assert created["seed"] not in str(hidden)
            assert "seedMaterial" not in hidden
            assert hidden["status"] == "COMPLETED"
            assert hidden["modelVersion"] == created["modelVersion"]
            assert "homeGoals" not in str(hidden)
            assert "winner" not in str(hidden)

        matches.matches[match_id] = MatchView("COMPLETED", "Premier Division")
        revealed = find_run(client, match_id, status="COMPLETED")

        assert revealed is not None
        assert revealed["score"] == {
            "home": created["result"]["homeGoals"],
            "away": created["result"]["awayGoals"],
        }
        assert revealed["seed"] == created["seed"]
        assert revealed["id"] == created["simulationId"]
        assert revealed["events"] == created["eventCount"]
        assert revealed["matchLabel"] == "Lagos Lions v Abuja Eagles"
        assert revealed["leagueName"] == "Premier Division"
        assert revealed["completedAt"].endswith("Z")
        assert "error" not in revealed

    def test_list_input_is_bounded(self, client: TestClient) -> None:
        for params in ({"limit": "201"}, {"limit": "0"}, {"status": "DROP TABLE"}):
            response = client.get(
                "/api/v1/admin/simulations", params=params, headers=admin_headers(READ)
            )
            assert response.status_code == 422


class TestRunActions:
    def test_a_completed_run_is_immutable(self, client: TestClient) -> None:
        created = run(client, new_match_id())

        for action in ("RETRY", "CANCEL"):
            response = client.post(
                f"/api/v1/admin/simulations/{created['simulationId']}/actions",
                json={"action": action, "reason": "try to change it"},
                headers=admin_headers(OPERATE),
            )
            assert response.status_code == 409
            assert response.json()["error"]["code"] == "RESULT_IMMUTABLE"

    def test_an_unknown_run_is_404(self, client: TestClient) -> None:
        response = client.post(
            f"/api/v1/admin/simulations/{new_match_id()}/actions",
            json={"action": "RETRY", "reason": "nothing there"},
            headers=admin_headers(OPERATE),
        )

        assert response.status_code == 404

    def test_retry_queues_a_failed_run_and_never_simulates(
        self, audit: FakeAuditRecorder, matches: FakeMatchReadModel
    ) -> None:
        match_id = new_match_id()

        with running_client(audit, matches, failing_simulate) as client:
            failed = client.post(
                f"/internal/simulation/matches/{match_id}/run", json=run_body(match_id)
            )
            assert failed.status_code == 502
            assert failed.json()["error"]["code"] == "SIMULATION_FAILED"

            listed = find_run(client, match_id, status="FAILED")
            assert listed is not None
            assert listed["score"] is None
            assert listed["seed"] is None
            assert listed["error"] == "ValueError: the engine was made to fail"
            url = f"/api/v1/admin/simulations/{listed['id']}/actions"

            queued = client.post(
                url,
                json={"action": "RETRY", "reason": "engine fixed"},
                headers=admin_headers(OPERATE),
            )
            assert queued.status_code == 200
            assert queued.json()["status"] == "QUEUED"
            assert queued.json()["score"] is None
            assert queued.json()["seed"] is None

            repeated = client.post(
                url,
                json={"action": "RETRY", "reason": "again"},
                headers=admin_headers(OPERATE),
            )
            assert repeated.status_code == 409
            assert repeated.json()["error"]["code"] == "CONFLICT"

            detail = client.get(f"/internal/simulation/matches/{match_id}").json()
            assert detail["result"] is None
            assert detail["run"]["status"] == "FAILED"

        assert "simulation_retry_requested" in audit.actions()

        with running_client(audit, matches) as client:
            rerun = run(client, match_id)
            assert rerun["duplicate"] is False

            superseded = client.post(
                url,
                json={"action": "RETRY", "reason": "too late"},
                headers=admin_headers(OPERATE),
            )
            assert superseded.status_code == 409
            assert superseded.json()["error"]["code"] == "RESULT_IMMUTABLE"

    def test_cancel_closes_a_failed_run(
        self, audit: FakeAuditRecorder, matches: FakeMatchReadModel
    ) -> None:
        match_id = new_match_id()

        with running_client(audit, matches, failing_simulate) as client:
            client.post(
                f"/internal/simulation/matches/{match_id}/run", json=run_body(match_id)
            )
            listed = find_run(client, match_id)
            assert listed is not None
            url = f"/api/v1/admin/simulations/{listed['id']}/actions"

            cancelled = client.post(
                url,
                json={"action": "CANCEL", "reason": "match was voided"},
                headers=admin_headers(OPERATE),
            )
            assert cancelled.status_code == 200
            assert cancelled.json()["status"] == "FAILED"
            assert cancelled.json()["error"].startswith("Cancelled by an operator.")

            again = client.post(
                url,
                json={"action": "RETRY", "reason": "changed my mind"},
                headers=admin_headers(OPERATE),
            )
            assert again.status_code == 409
            assert again.json()["error"]["code"] == "CONFLICT"

    @pytest.mark.parametrize("action", ["RETRY", "CANCEL"])
    def test_an_action_is_refused_when_its_audit_cannot_be_written(
        self, audit: FakeAuditRecorder, matches: FakeMatchReadModel, action: str
    ) -> None:
        match_id = new_match_id()

        with running_client(audit, matches, failing_simulate) as client:
            client.post(
                f"/internal/simulation/matches/{match_id}/run", json=run_body(match_id)
            )
            listed = find_run(client, match_id, status="FAILED")
            assert listed is not None
            url = f"/api/v1/admin/simulations/{listed['id']}/actions"
            audit.fail = True

            refused = client.post(
                url,
                json={"action": action, "reason": "unaudited action"},
                headers=admin_headers(OPERATE),
            )

            assert refused.status_code == 503
            assert refused.json()["error"]["code"] == "UPSTREAM_UNAVAILABLE"
            assert "identity is down" not in refused.text
            unchanged = find_run(client, match_id, status="FAILED")
            assert unchanged is not None
            assert unchanged["id"] == listed["id"]
            assert "error" in unchanged
            assert not unchanged["error"].startswith("Cancelled")

            audit.fail = False
            applied = client.post(
                url,
                json={"action": action, "reason": "audited action"},
                headers=admin_headers(OPERATE),
            )
            assert applied.status_code == 200

        entry = audit.entries[-1]
        assert entry.action in {"simulation_retry_requested", "simulation_cancelled"}
        assert entry.actor_id == "33333333-3333-4333-8333-333333333331"
        assert entry.before == {"status": "FAILED", "matchId": match_id}
        assert entry.after is not None
        assert entry.reason == "audited action"

    def test_no_action_can_set_a_result(self, client: TestClient) -> None:
        created = run(client, new_match_id())

        response = client.post(
            f"/api/v1/admin/simulations/{created['simulationId']}/actions",
            json={"action": "SET_SCORE", "reason": "pick a winner", "homeGoals": 5},
            headers=admin_headers(OPERATE),
        )

        assert response.status_code == 422


class TestConfiguration:
    def test_put_creates_a_new_active_version_and_audits_it(
        self, client: TestClient, audit: FakeAuditRecorder
    ) -> None:
        headers = admin_headers(READ, OPERATE)
        before = client.get("/api/v1/admin/simulation/config", headers=headers).json()
        original = before["params"]["baseGoals"]
        changed = (
            round(original + 0.05, 4) if original < 4 else round(original - 0.05, 4)
        )

        updated = client.put(
            "/api/v1/admin/simulation/config",
            json={"baseGoals": changed, "reason": "tune scoring"},
            headers=headers,
        )
        assert updated.status_code == 200
        body = updated.json()
        assert body["version"] == before["version"] + 1
        assert body["active"] is True
        assert body["params"]["baseGoals"] == changed
        assert body["params"]["maxGoals"] == before["params"]["maxGoals"]
        assert body["reason"] == "tune scoring"

        current = client.get("/api/v1/admin/simulation/config", headers=headers).json()
        assert current["version"] == body["version"]

        entry = audit.entries[-1]
        assert entry.action == "simulation_configuration_changed"
        assert entry.before is not None
        assert entry.after is not None
        assert entry.before["version"] == before["version"]
        assert entry.after["params"]["baseGoals"] == changed
        assert entry.reason == "tune scoring"

        match_id = new_match_id()
        assert run(client, match_id)["configurationVersion"] == body["version"]

        restored = client.put(
            "/api/v1/admin/simulation/config",
            json={"baseGoals": original, "reason": "restore after test"},
            headers=headers,
        )
        assert restored.status_code == 200

    def test_the_change_fails_when_the_audit_cannot_be_written(
        self, client: TestClient, audit: FakeAuditRecorder
    ) -> None:
        headers = admin_headers(READ, OPERATE)
        before = client.get("/api/v1/admin/simulation/config", headers=headers).json()
        audit.fail = True

        response = client.put(
            "/api/v1/admin/simulation/config",
            json={"assistProbability": 0.5, "reason": "unaudited change"},
            headers=headers,
        )

        assert response.status_code == 503
        assert response.json()["error"]["code"] == "UPSTREAM_UNAVAILABLE"
        assert "identity is down" not in response.text
        after = client.get("/api/v1/admin/simulation/config", headers=headers).json()
        assert after == before

    @pytest.mark.parametrize(
        "body",
        [
            {"reason": "nothing to change"},
            {"baseGoals": 99, "reason": "out of bounds"},
            {"maxGoals": 500, "reason": "unbounded matrix"},
            {"maxSubstitutions": 6, "reason": "more than five"},
            {"baseGoals": None, "reason": "null"},
            {"version": 1, "reason": "edit an old version"},
            {"modelVersion": "x", "reason": "rename the model"},
            {"minSubstitutions": 5, "maxSubstitutions": 2, "reason": "inverted"},
            {"baseGoals": 1.2},
        ],
    )
    def test_invalid_changes_are_rejected(
        self, client: TestClient, body: dict[str, Any]
    ) -> None:
        response = client.put(
            "/api/v1/admin/simulation/config",
            json=body,
            headers=admin_headers(OPERATE),
        )

        assert response.status_code == 422
        assert response.json()["error"]["code"] == "VALIDATION_FAILED"
