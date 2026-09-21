from __future__ import annotations

import re
import uuid

import pytest

from conftest import Harness, admin_headers


class TestMatchOdds:
    def test_answers_the_contract_shape(self, harness: Harness) -> None:
        match_id = harness.publish()
        response = harness.client.get(f"/api/v1/matches/{match_id}/odds")

        assert response.status_code == 200
        body = response.json()
        assert set(body) == {"matchId", "markets", "generatedAt"}
        assert body["matchId"] == match_id
        assert len(body["markets"]) == 8

        result = body["markets"][0]
        assert set(result) == {
            "id",
            "matchId",
            "type",
            "status",
            "oddsVersion",
            "selections",
            "updatedAt",
        }
        assert (result["type"], result["status"], result["oddsVersion"]) == (
            "MATCH_RESULT",
            "OPEN",
            1,
        )
        assert set(result["selections"][0]) == {
            "id",
            "marketId",
            "code",
            "label",
            "odds",
            "probability",
        }
        assert result["selections"][0]["marketId"] == result["id"]
        assert re.fullmatch(
            r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z", result["updatedAt"]
        )

        lines = {m["type"]: m.get("line") for m in body["markets"] if "line" in m}
        assert lines == {"OVER_UNDER": 3.5, "GOAL_SPREAD": -1.5}

    def test_odds_are_json_numbers_with_at_most_two_decimals(
        self, harness: Harness
    ) -> None:
        match_id = harness.publish()
        text = harness.client.get(f"/api/v1/matches/{match_id}/odds").text
        prices = re.findall(r'"odds":([^,}]+)', text)

        assert len(prices) == 33
        for price in prices:
            assert re.fullmatch(r"\d+(\.\d{1,2})?", price), price
            assert 1 < float(price) <= 1000

    def test_a_match_without_markets_answers_an_empty_list(
        self, harness: Harness
    ) -> None:
        match_id = str(uuid.uuid4())
        body = harness.client.get(f"/api/v1/matches/{match_id}/odds").json()

        assert body["matchId"] == match_id
        assert body["markets"] == []
        assert "generatedAt" in body

    def test_a_malformed_match_id_is_rejected(self, harness: Harness) -> None:
        response = harness.client.get("/api/v1/matches/'%3B%20DROP%20TABLE/odds")

        assert response.status_code == 422
        assert response.json()["error"]["code"] == "VALIDATION_FAILED"

    def test_two_reads_return_the_same_rows(self, harness: Harness) -> None:
        match_id = harness.publish()
        path = f"/api/v1/matches/{match_id}/odds"

        assert (
            harness.client.get(path).json()["markets"]
            == harness.client.get(path).json()["markets"]
        )

    def test_the_actor_headers_are_never_echoed(self, harness: Harness) -> None:
        response = harness.client.get(
            f"/api/v1/matches/{uuid.uuid4()}/odds",
            headers={"x-betng-actor-kind": "ADMIN", "x-betng-actor-id": "spoof"},
        )

        assert not [h for h in response.headers if h.lower().startswith("x-betng-")]


class TestBulkOdds:
    def test_answers_one_entry_per_requested_match_in_order(
        self, harness: Harness
    ) -> None:
        first = harness.publish()
        empty = str(uuid.uuid4())
        second = harness.publish()
        response = harness.client.get(
            "/api/v1/odds", params={"matchIds": f"{first},{empty},{second},{first}"}
        )

        assert response.status_code == 200
        items = response.json()["items"]
        assert [item["matchId"] for item in items] == [first, empty, second]
        assert [len(item["markets"]) for item in items] == [8, 0, 8]
        assert items[0] == {
            **harness.client.get(f"/api/v1/matches/{first}/odds").json(),
            "generatedAt": items[0]["generatedAt"],
        }

    def test_accepts_sixty_ids_and_rejects_sixty_one(self, harness: Harness) -> None:
        def ids(count: int) -> str:
            return ",".join(str(uuid.uuid4()) for _ in range(count))

        accepted = harness.client.get("/api/v1/odds", params={"matchIds": ids(60)})
        rejected = harness.client.get("/api/v1/odds", params={"matchIds": ids(61)})

        assert accepted.status_code == 200
        assert len(accepted.json()["items"]) == 60
        assert rejected.status_code == 422
        assert rejected.json()["error"]["code"] == "VALIDATION_FAILED"

    def test_rejects_missing_empty_and_malformed_ids(self, harness: Harness) -> None:
        for params in ({}, {"matchIds": ""}, {"matchIds": ","}, {"matchIds": "abc"}):
            response = harness.client.get("/api/v1/odds", params=params)

            assert response.status_code == 422, params
            assert response.json()["error"]["code"] == "VALIDATION_FAILED"


class TestSnapshots:
    def test_returns_the_history_in_the_contract_shape(self, harness: Harness) -> None:
        match_id = harness.publish()
        market = harness.client.get(f"/api/v1/matches/{match_id}/odds").json()[
            "markets"
        ][0]
        harness.rpc(
            "odds.setMatchMarketsStatus", {"matchId": match_id, "status": "CLOSED"}
        )
        response = harness.client.get(
            f"/internal/odds/markets/{market['id']}/snapshots"
        )

        assert response.status_code == 200
        items = response.json()["items"]
        assert [(i["oddsVersion"], i["reason"]) for i in items] == [
            (1, "INITIAL"),
            (2, "STATUS_CHANGE"),
        ]
        assert set(items[0]) == {
            "id",
            "marketId",
            "matchId",
            "oddsVersion",
            "reason",
            "prices",
            "createdAt",
        }
        assert items[0]["prices"] == [
            {
                "selectionId": s["id"],
                "code": s["code"],
                "odds": s["odds"],
                "probability": s["probability"],
            }
            for s in market["selections"]
        ]

    def test_an_unknown_market_is_not_found(self, harness: Harness) -> None:
        response = harness.client.get(
            f"/internal/odds/markets/{uuid.uuid4()}/snapshots"
        )

        assert response.status_code == 404
        assert response.json()["error"]["code"] == "NOT_FOUND"


INTERNAL_TOKEN = "odds-test-internal-token-0123456789abcdef"


class TestInternalToken:
    def test_internal_routes_answer_404_without_the_token(
        self, harness: Harness, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        match_id = harness.publish()
        market = harness.client.get(f"/api/v1/matches/{match_id}/odds").json()[
            "markets"
        ][0]
        path = f"/internal/odds/markets/{market['id']}/snapshots"
        monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", INTERNAL_TOKEN)

        missing = harness.client.get(path)
        wrong = harness.client.get(
            path, headers={"x-betng-internal-token": "x" * len(INTERNAL_TOKEN)}
        )
        accepted = harness.client.get(
            path, headers={"x-betng-internal-token": INTERNAL_TOKEN}
        )

        for refused in (missing, wrong):
            assert refused.status_code == 404
            assert refused.json()["error"]["code"] == "NOT_FOUND"
            assert "items" not in refused.json()

        assert accepted.status_code == 200
        assert [i["oddsVersion"] for i in accepted.json()["items"]] == [1]

    def test_the_kit_guards_rpc_and_the_actor_headers_with_the_same_token(
        self, harness: Harness, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", INTERNAL_TOKEN)
        frame = {
            "id": "1",
            "procedure": "odds.setMatchMarketsStatus",
            "payload": {"matchId": str(uuid.uuid4()), "status": "CLOSED"},
            "metadata": {},
            "timestamp": 0,
        }
        headers = admin_headers("odds:read")

        outsider_rpc = harness.client.post("/rpc", json=frame)
        outsider_admin = harness.client.get(
            "/api/v1/admin/odds/config", headers=headers
        )
        insider_admin = harness.client.get(
            "/api/v1/admin/odds/config",
            headers={**headers, "x-betng-internal-token": INTERNAL_TOKEN},
        )
        public = harness.client.get(f"/api/v1/matches/{uuid.uuid4()}/odds")

        assert outsider_rpc.json().get("success") is not True
        assert outsider_admin.status_code == 401
        assert insider_admin.status_code == 200
        assert public.status_code == 200
