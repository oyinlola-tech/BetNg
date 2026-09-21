from __future__ import annotations

import uuid
from typing import Any

import psycopg
import pytest
from betng_service_kit import RpcError
from fastapi.testclient import TestClient

from betng_risk.errors import AuditUnavailableError
from betng_risk.repositories import IdentityAuditRecorder
from betng_risk.types import AuditEntry
from conftest import (
    ADMIN_ID,
    DEFAULT_LIMITS,
    Book,
    FakeAudit,
    admin_headers,
    evaluate_payload,
    rpc,
)

READ = admin_headers("risk:read")
WRITE = admin_headers("risk:read", "risk:write")
INTERNAL_TOKEN = "test-internal-service-token-0123456789abcdef"
TOKEN_HEADER = {"x-betng-internal-token": INTERNAL_TOKEN}

ADMIN_ROUTES = [
    ("GET", "/api/v1/admin/risk/overview"),
    ("GET", "/api/v1/admin/risk/exposure"),
    ("GET", "/api/v1/admin/risk/limits"),
    ("PUT", "/api/v1/admin/risk/limits"),
]


def active_limits(superuser: psycopg.Connection[Any]) -> dict[str, Any]:
    row = superuser.execute("SELECT * FROM risk.risk_limits WHERE active").fetchone()
    assert row is not None
    return dict(row)


class TestPermissions:
    @pytest.mark.parametrize(("method", "path"), ADMIN_ROUTES)
    def test_an_anonymous_call_is_unauthenticated(
        self, client: TestClient, method: str, path: str
    ) -> None:
        response = client.request(method, path, json={"reason": "No actor at all"})

        assert response.status_code == 401
        assert response.json()["error"]["code"] == "UNAUTHENTICATED"

    @pytest.mark.parametrize(("method", "path"), ADMIN_ROUTES)
    def test_an_admin_without_the_permission_is_forbidden(
        self, client: TestClient, method: str, path: str
    ) -> None:
        response = client.request(
            method,
            path,
            json={"reason": "Wrong permission"},
            headers=admin_headers("odds:read", "settings:write"),
        )

        assert response.status_code == 403
        assert response.json()["error"]["code"] == "FORBIDDEN"

    @pytest.mark.parametrize("kind", ["CUSTOMER", "CASHIER"])
    def test_a_non_admin_holding_the_permission_name_is_forbidden(
        self, client: TestClient, kind: str
    ) -> None:
        headers = {**WRITE, "x-betng-actor-kind": kind}

        for method, path in ADMIN_ROUTES:
            response = client.request(
                method, path, json={"reason": "Not an admin"}, headers=headers
            )
            assert response.status_code == 403

    def test_read_permission_does_not_allow_a_limits_change(
        self, client: TestClient, superuser: psycopg.Connection[Any]
    ) -> None:
        before = active_limits(superuser)["version"]

        response = client.put(
            "/api/v1/admin/risk/limits",
            json={"minStake": 10_000, "reason": "Read-only analyst"},
            headers=READ,
        )

        assert response.status_code == 403
        assert active_limits(superuser)["version"] == before


class TestInternalToken:
    def test_internal_routes_answer_404_without_the_token(
        self, client: TestClient, book: Book, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        match = book.match()
        market = book.market(match)
        monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", INTERNAL_TOKEN)
        path = f"/internal/risk/matches/{match.id}/exposure"
        payload = evaluate_payload(100_000, [(market, "HOME")])

        assert client.get(path).status_code == 404
        assert (
            client.get(path, headers={"x-betng-internal-token": "wrong"}).status_code
            == 404
        )
        assert client.post("/internal/risk/evaluate", json=payload).status_code == 404

        assert client.get(path, headers=TOKEN_HEADER).status_code == 200
        accepted = client.post(
            "/internal/risk/evaluate", json=payload, headers=TOKEN_HEADER
        )
        assert accepted.status_code == 200

    def test_rpc_answers_404_without_the_token(
        self, client: TestClient, book: Book, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        market = book.market(book.match())
        monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", INTERNAL_TOKEN)
        frame = {
            "id": "rpc-token-1",
            "procedure": "risk.evaluate",
            "payload": evaluate_payload(100_000, [(market, "HOME")]),
            "metadata": {},
            "timestamp": 0,
        }

        refused = client.post("/rpc", json=frame)
        assert refused.status_code == 404
        assert refused.json()["success"] is False
        assert "result" not in refused.json()

        accepted = client.post("/rpc", json=frame, headers=TOKEN_HEADER)
        assert accepted.status_code == 200
        assert accepted.json()["success"] is True

    def test_actor_headers_without_the_token_are_ignored(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", INTERNAL_TOKEN)

        forged = client.get("/api/v1/admin/risk/limits", headers=READ)
        assert forged.status_code == 401

        genuine = client.get(
            "/api/v1/admin/risk/limits", headers={**READ, **TOKEN_HEADER}
        )
        assert genuine.status_code == 200


class TestInternalEvaluate:
    def test_decides_and_stores_with_the_http_request_id(
        self, client: TestClient, book: Book, superuser: psycopg.Connection[Any]
    ) -> None:
        market = book.market(book.match())
        request_id = f"trace-{uuid.uuid4()}"

        response = client.post(
            "/internal/risk/evaluate",
            json=evaluate_payload(100_000, [(market, "HOME")]),
            headers={"x-request-id": request_id},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["decision"] == "ACCEPT"
        row = superuser.execute(
            "SELECT request_id FROM risk.risk_decisions WHERE id = %s",
            (body["decisionId"],),
        ).fetchone()
        assert row is not None
        assert row["request_id"] == request_id

    def test_a_malformed_body_is_a_validation_failure(self, client: TestClient) -> None:
        response = client.post("/internal/risk/evaluate", json={"stake": -5})

        assert response.status_code == 422
        assert response.json()["error"]["code"] == "VALIDATION_FAILED"


class TestLimits:
    def test_reads_the_limits_in_force(
        self, client: TestClient, superuser: psycopg.Connection[Any]
    ) -> None:
        response = client.get("/api/v1/admin/risk/limits", headers=READ)

        assert response.status_code == 200
        body = response.json()
        row = active_limits(superuser)
        assert body["version"] == row["version"]
        assert body["minStake"] == 5_000
        assert body["maxStakePerBet"] == 50_000_000
        assert body["maxPayoutPerBet"] == 2_000_000_000
        assert body["maxLiabilityPerSelection"] == 1_500_000_000
        assert body["maxLiabilityPerMarket"] == 3_000_000_000
        assert body["maxLiabilityPerMatch"] == 6_000_000_000
        assert body["updatedAt"].endswith("Z")
        assert body["updatedBy"] == row["created_by"]

    def test_an_update_inserts_a_new_version_and_audits_it(
        self, client: TestClient, audit: FakeAudit, superuser: psycopg.Connection[Any]
    ) -> None:
        before = active_limits(superuser)
        request_id = f"trace-{uuid.uuid4()}"

        response = client.put(
            "/api/v1/admin/risk/limits",
            json={
                "maxStakePerBet": 25_000_000,
                "maxLiabilityPerMatch": 5_000_000_000,
                "reason": "Tighter book for the weekend",
            },
            headers={**WRITE, "x-request-id": request_id},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["version"] == before["version"] + 1
        assert body["maxStakePerBet"] == 25_000_000
        assert body["maxLiabilityPerMatch"] == 5_000_000_000
        assert body["minStake"] == before["min_stake"]
        assert body["updatedBy"] == ADMIN_ID

        after = active_limits(superuser)
        assert after["version"] == before["version"] + 1
        assert after["created_by"] == ADMIN_ID
        assert after["reason"] == "Tighter book for the weekend"
        previous = superuser.execute(
            "SELECT active, max_stake_per_bet FROM risk.risk_limits WHERE version = %s",
            (before["version"],),
        ).fetchone()
        assert previous is not None
        assert previous["active"] is False
        assert previous["max_stake_per_bet"] == before["max_stake_per_bet"]

        (entry,) = audit.entries
        assert entry.action == "risk_configuration_changed"
        assert entry.actor_id == ADMIN_ID
        assert entry.actor_role == "RISK_ANALYST"
        assert entry.entity_type == "risk_limits"
        assert entry.entity_id == str(after["version"])
        assert entry.request_id == request_id
        assert entry.reason == "Tighter book for the weekend"
        assert entry.before["version"] == before["version"]
        assert entry.before["maxStakePerBet"] == before["max_stake_per_bet"]
        assert entry.after["version"] == after["version"]
        assert entry.after["maxStakePerBet"] == 25_000_000

    def test_new_limits_apply_to_the_next_evaluation(
        self, client: TestClient, book: Book
    ) -> None:
        market = book.market(book.match())
        client.put(
            "/api/v1/admin/risk/limits",
            json={"maxStakePerBet": 1_000_000, "reason": "Small stakes only"},
            headers=WRITE,
        )

        body = rpc(
            client, "risk.evaluate", evaluate_payload(2_000_000, [(market, "HOME")])
        )

        assert body["result"] == {
            "decisionId": body["result"]["decisionId"],
            "decision": "LIMIT",
            "reason": "STAKE_LIMIT",
            "maxStake": 1_000_000,
        }

    def test_an_audit_failure_rolls_the_version_back(
        self, client: TestClient, audit: FakeAudit, superuser: psycopg.Connection[Any]
    ) -> None:
        before = active_limits(superuser)
        audit.fail = True

        response = client.put(
            "/api/v1/admin/risk/limits",
            json={"minStake": 10_000, "reason": "Audit is down"},
            headers=WRITE,
        )

        assert response.status_code == 503
        assert response.json()["error"]["code"] == "UPSTREAM_UNAVAILABLE"
        assert active_limits(superuser) == before
        count = superuser.execute(
            "SELECT count(*) AS versions FROM risk.risk_limits WHERE version > %s",
            (before["version"],),
        ).fetchone()
        assert count is not None
        assert count["versions"] == 0

    @pytest.mark.parametrize(
        "body",
        [
            {"minStake": 10_000},
            {"minStake": 10_000, "reason": "no"},
            {"minStake": 0, "reason": "Zero minimum"},
            {"minStake": 10.5, "reason": "Fractional kobo"},
            {"minStake": 10_000, "reason": "Unknown key", "exposureLimit": 1},
            {"minStake": 60_000_000, "reason": "Minimum above the maximum"},
            {"maxPayoutPerBet": 1_000, "reason": "Payout below the stake cap"},
            {"reason": "Nothing changes"},
            {"minStake": DEFAULT_LIMITS["min_stake"], "reason": "Same value"},
        ],
    )
    def test_an_invalid_update_changes_nothing(
        self,
        client: TestClient,
        audit: FakeAudit,
        superuser: psycopg.Connection[Any],
        body: dict[str, Any],
    ) -> None:
        before = active_limits(superuser)

        response = client.put("/api/v1/admin/risk/limits", json=body, headers=WRITE)

        assert response.status_code == 422
        assert response.json()["error"]["code"] == "VALIDATION_FAILED"
        assert active_limits(superuser) == before
        assert audit.entries == []


class TestExposureDashboard:
    def items(self, client: TestClient) -> list[dict[str, Any]]:
        response = client.get("/api/v1/admin/risk/exposure", headers=READ)
        assert response.status_code == 200
        return list(response.json()["items"])

    def test_lists_open_matches_and_unsettled_matches_with_pending_bets(
        self, client: TestClient, book: Book
    ) -> None:
        user = str(uuid.uuid4())
        open_with_bets, open_empty = book.match(), book.match()
        closed_with_bets = book.match(lifecycle="EVENTS_PUBLISHED", status="IN_PLAY")
        closed_empty = book.match(lifecycle="BETTING_CLOSED", status="BETTING_CLOSED")
        settled = book.match(lifecycle="SETTLEMENT_COMPLETED", status="COMPLETED")
        unpublished = book.match(lifecycle="FIXTURE_CREATED", status="SCHEDULED")

        market = book.market(open_with_bets)
        book.bet(250_000, [(open_with_bets, market, "DRAW")], user_id=user)
        closed_market = book.market(closed_with_bets, status="CLOSED")
        book.bet(100_000, [(closed_with_bets, closed_market, "HOME")], user_id=user)
        settled_market = book.market(settled, status="SETTLED")
        book.bet(
            100_000, [(settled, settled_market, "HOME")], user_id=user, status="WON"
        )

        items = {item["matchId"]: item for item in self.items(client)}

        assert open_with_bets.id in items
        assert open_empty.id in items
        assert closed_with_bets.id in items
        assert closed_empty.id not in items
        assert settled.id not in items
        assert unpublished.id not in items

        backed = items[open_with_bets.id]
        assert backed["bets"] == 1
        assert backed["totalStake"] == 250_000
        assert backed["worstCaseExposure"] == 600_000
        assert [m["marketId"] for m in backed["markets"]] == [market.id]
        assert [row["code"] for row in backed["markets"][0]["selections"]] == [
            "HOME",
            "DRAW",
            "AWAY",
        ]
        assert backed["markets"][0]["selections"][1]["odds"] == 3.4

        empty = items[open_empty.id]
        assert (empty["bets"], empty["totalStake"], empty["worstCaseExposure"]) == (
            0,
            0,
            0,
        )
        assert empty["status"] == "NORMAL"
        assert empty["markets"] == []

        assert items[closed_with_bets.id]["lifecycle"] == "EVENTS_PUBLISHED"

    def test_is_ordered_by_kickoff(self, client: TestClient, book: Book) -> None:
        for _ in range(3):
            book.match()

        kickoffs = [item["kickoffAt"] for item in self.items(client)]

        assert kickoffs == sorted(kickoffs)

    def test_a_frozen_match_is_listed_as_frozen(
        self, client: TestClient, book: Book
    ) -> None:
        match = book.match(lifecycle="BETTING_CLOSED", status="BETTING_CLOSED")
        market = book.market(match, status="CLOSED")
        book.bet(100_000, [(match, market, "HOME")], user_id=str(uuid.uuid4()))
        rpc(client, "risk.freezeExposure", {"matchId": match.id})

        item = next(item for item in self.items(client) if item["matchId"] == match.id)

        assert item["status"] == "FROZEN"
        assert item["frozenAt"].endswith("Z")
        assert item["totalStake"] == 100_000


class TestOverview:
    def overview(self, client: TestClient) -> dict[str, Any]:
        response = client.get("/api/v1/admin/risk/overview", headers=READ)
        assert response.status_code == 200
        return dict(response.json())

    def test_every_figure_moves_with_the_rows(
        self, client: TestClient, book: Book
    ) -> None:
        before = self.overview(client)

        match = book.match()
        market = book.market(match)
        book.bet(1_000_000, [(match, market, "HOME")], user_id=str(uuid.uuid4()))
        book.bet(500_000, [(match, market, "AWAY")], shop_id=str(uuid.uuid4()))
        rpc(client, "risk.evaluate", evaluate_payload(100_000, [(market, "HOME")]))
        rpc(client, "risk.evaluate", evaluate_payload(60_000_000, [(market, "HOME")]))
        rpc(client, "risk.evaluate", evaluate_payload(100, [(market, "HOME")]))

        after = self.overview(client)

        # HOME pays 2,000,000 and AWAY 1,900,000 against 1,500,000 staked.
        assert after["totalStake"] - before["totalStake"] == 1_500_000
        assert after["potentialPayout"] - before["potentialPayout"] == 3_900_000
        assert after["exposure"] - before["exposure"] == 500_000
        assert after["decisions"]["accepted"] - before["decisions"]["accepted"] == 1
        assert after["decisions"]["limited"] - before["decisions"]["limited"] == 1
        assert after["decisions"]["rejected"] - before["decisions"]["rejected"] == 1

        line = next(item for item in after["byMatch"] if item["matchId"] == match.id)
        assert line == {
            "matchId": match.id,
            "matchLabel": match.label,
            "leagueName": match.league_name,
            "kickoffAt": line["kickoffAt"],
            "stake": 1_500_000,
            "exposure": 500_000,
            "state": "NORMAL",
        }
        assert after["exposureLimit"] == 6_000_000_000 * len(after["byMatch"])
        assert after["state"] == "NORMAL"
        assert after["generatedAt"].endswith("Z")

        def result_market(body: dict[str, Any]) -> dict[str, int]:
            for entry in body["byMarket"]:
                if entry["marketType"] == "MATCH_RESULT":
                    return {"stake": entry["stake"], "exposure": entry["exposure"]}
            return {"stake": 0, "exposure": 0}

        assert (
            result_market(after)["stake"] - result_market(before)["stake"] == 1_500_000
        )
        assert (
            result_market(after)["exposure"] - result_market(before)["exposure"]
            == 500_000
        )
        labels = {e["marketType"]: e["marketLabel"] for e in after["byMarket"]}
        assert labels["MATCH_RESULT"] == "Match Result"


class FailingRpcClient:
    async def call(
        self, procedure: str, payload: Any, *, request_id: str | None = None
    ) -> Any:
        raise RpcError("RPC_UNAVAILABLE", "The identity service could not be reached.")


class RecordingRpcClient:
    def __init__(self) -> None:
        self.calls: list[tuple[str, Any, str | None]] = []

    async def call(
        self, procedure: str, payload: Any, *, request_id: str | None = None
    ) -> Any:
        self.calls.append((procedure, payload, request_id))
        return {"id": str(uuid.uuid4())}


ENTRY = AuditEntry(
    actor_id=ADMIN_ID,
    actor_role="RISK_ANALYST",
    action="risk_configuration_changed",
    entity_type="risk_limits",
    entity_id="2",
    before={"version": 1},
    after={"version": 2},
    reason="Tighter book",
    severity="WARNING",
    request_id="trace-audit-0001",
)


class TestIdentityAuditRecorder:
    async def test_calls_identity_record_audit_with_the_contract_payload(self) -> None:
        import logging

        rpc_client = RecordingRpcClient()
        recorder = IdentityAuditRecorder(rpc_client, logging.getLogger("test"))  # type: ignore[arg-type]

        await recorder.record(ENTRY)

        ((procedure, payload, request_id),) = rpc_client.calls
        assert procedure == "identity.recordAudit"
        assert request_id == "trace-audit-0001"
        assert payload == {
            "actorId": ADMIN_ID,
            "actorRole": "RISK_ANALYST",
            "action": "risk_configuration_changed",
            "entityType": "risk_limits",
            "entityId": "2",
            "before": {"version": 1},
            "after": {"version": 2},
            "reason": "Tighter book",
            "severity": "WARNING",
            "requestId": "trace-audit-0001",
        }

    async def test_an_rpc_failure_becomes_a_refusal(self) -> None:
        import logging

        recorder = IdentityAuditRecorder(FailingRpcClient(), logging.getLogger("test"))  # type: ignore[arg-type]

        with pytest.raises(AuditUnavailableError):
            await recorder.record(ENTRY)
