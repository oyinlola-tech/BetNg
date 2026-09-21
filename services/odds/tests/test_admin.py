from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Any

import psycopg
import pytest

from betng_odds.types import SelectionExposure
from conftest import Harness, admin_headers

Database = psycopg.Connection[dict[str, Any]]

READ = admin_headers("odds:read")
WRITE = admin_headers("odds:read", "odds:write")
SUSPEND = {"action": "SUSPEND", "reason": "Unusual betting pattern"}
RESUME = {"action": "RESUME", "reason": "Pattern reviewed and cleared"}


def first_market(harness: Harness, match_id: str) -> dict[str, Any]:
    odds = harness.client.get(f"/api/v1/matches/{match_id}/odds").json()

    return dict(odds["markets"][0])


def market_row(database: Database, market_id: str) -> dict[str, Any]:
    row = database.execute(
        "SELECT status, odds_version FROM odds.markets WHERE id = %s", (market_id,)
    ).fetchone()
    database.commit()
    assert row is not None

    return row


def snapshot_versions(database: Database, market_id: str) -> list[tuple[int, str, str]]:
    result = [
        (row["odds_version"], row["reason"], row["status"])
        for row in database.execute(
            "SELECT odds_version, reason, status FROM odds.odds_snapshots "
            "WHERE market_id = %s ORDER BY odds_version",
            (market_id,),
        ).fetchall()
    ]
    database.commit()

    return result


class TestPermissions:
    @pytest.mark.parametrize(
        ("method", "path", "body"),
        [
            ("GET", "/api/v1/admin/odds", None),
            ("GET", "/api/v1/admin/odds/config", None),
            ("PUT", "/api/v1/admin/odds/config", {}),
            ("POST", f"/api/v1/admin/markets/{uuid.uuid4()}/actions", SUSPEND),
        ],
    )
    def test_anonymous_calls_are_unauthenticated(
        self, harness: Harness, method: str, path: str, body: Any
    ) -> None:
        response = harness.client.request(method, path, json=body)

        assert response.status_code == 401
        assert response.json()["error"]["code"] == "UNAUTHENTICATED"

    @pytest.mark.parametrize(
        ("method", "path", "headers"),
        [
            ("GET", "/api/v1/admin/odds", admin_headers("bets:read")),
            ("GET", "/api/v1/admin/odds/config", admin_headers("odds:write")),
            ("PUT", "/api/v1/admin/odds/config", READ),
            ("POST", f"/api/v1/admin/markets/{uuid.uuid4()}/actions", READ),
            # The permission alone is not enough: the actor must be an admin.
            ("GET", "/api/v1/admin/odds", admin_headers("odds:read", kind="CUSTOMER")),
            (
                "POST",
                f"/api/v1/admin/markets/{uuid.uuid4()}/actions",
                admin_headers("odds:write", kind="CASHIER"),
            ),
        ],
    )
    def test_the_wrong_permission_or_actor_kind_is_forbidden(
        self, harness: Harness, method: str, path: str, headers: dict[str, str]
    ) -> None:
        response = harness.client.request(method, path, json=SUSPEND, headers=headers)

        assert response.status_code == 403
        assert response.json()["error"]["code"] == "FORBIDDEN"


class TestMarketActions:
    def test_suspend_bumps_the_version_snapshots_audits_and_announces(
        self, harness: Harness, database: Database
    ) -> None:
        match_id = harness.publish()
        market = first_market(harness, match_id)
        response = harness.client.post(
            f"/api/v1/admin/markets/{market['id']}/actions",
            json=SUSPEND,
            headers={**WRITE, "x-request-id": "trace-suspend-1"},
        )

        assert response.status_code == 200, response.text
        body = response.json()
        assert body["marketId"] == market["id"]
        assert body["status"] == "SUSPENDED"
        assert body["matchLabel"] == "Lagos Lions v Abuja Tigers"
        assert body["marketLabel"] == "Match Result"

        assert market_row(database, market["id"]) == {
            "status": "SUSPENDED",
            "odds_version": 2,
        }
        assert snapshot_versions(database, market["id"]) == [
            (1, "INITIAL", "OPEN"),
            (2, "STATUS_CHANGE", "SUSPENDED"),
        ]

        assert harness.peers.event_publisher.published == [
            {"matchId": match_id, "description": "MATCH_RESULT market suspended"}
        ]
        [entry] = harness.peers.audit_recorder.entries
        assert entry.action == "market_suspended"
        assert entry.entity_type == "market"
        assert entry.entity_id == market["id"]
        assert entry.actor_id == WRITE["x-betng-actor-id"]
        assert entry.actor_role == "TRADER"
        assert entry.before == {"status": "OPEN", "oddsVersion": 1}
        assert entry.after == {"status": "SUSPENDED", "oddsVersion": 2}
        assert entry.reason == SUSPEND["reason"]
        assert entry.request_id == "trace-suspend-1"

        public = first_market(harness, match_id)
        assert (public["status"], public["oddsVersion"]) == ("SUSPENDED", 2)
        assert public["selections"] == market["selections"]

    def test_resume_reopens_at_the_next_version(
        self, harness: Harness, database: Database
    ) -> None:
        market = first_market(harness, harness.publish())
        path = f"/api/v1/admin/markets/{market['id']}/actions"

        assert harness.client.post(path, json=SUSPEND, headers=WRITE).status_code == 200
        response = harness.client.post(path, json=RESUME, headers=WRITE)

        assert response.status_code == 200
        assert response.json()["status"] == "OPEN"
        assert market_row(database, market["id"]) == {
            "status": "OPEN",
            "odds_version": 3,
        }
        assert [e.action for e in harness.peers.audit_recorder.entries] == [
            "market_suspended",
            "market_resumed",
        ]

    def test_an_audit_failure_rolls_the_action_back(
        self, harness: Harness, database: Database
    ) -> None:
        market = first_market(harness, harness.publish())
        harness.peers.audit_recorder.fail = True
        response = harness.client.post(
            f"/api/v1/admin/markets/{market['id']}/actions", json=SUSPEND, headers=WRITE
        )

        assert response.status_code == 503
        assert response.json()["error"]["code"] == "UPSTREAM_UNAVAILABLE"
        assert market_row(database, market["id"]) == {
            "status": "OPEN",
            "odds_version": 1,
        }
        assert snapshot_versions(database, market["id"]) == [(1, "INITIAL", "OPEN")]
        assert harness.peers.event_publisher.published == []

    def test_an_event_failure_does_not_undo_the_action(
        self, harness: Harness, database: Database
    ) -> None:
        market = first_market(harness, harness.publish())
        harness.peers.event_publisher.fail = True
        response = harness.client.post(
            f"/api/v1/admin/markets/{market['id']}/actions", json=SUSPEND, headers=WRITE
        )

        assert response.status_code == 200
        assert market_row(database, market["id"])["status"] == "SUSPENDED"
        assert len(harness.peers.audit_recorder.entries) == 1

    def test_a_suspension_survives_the_scheduler_opening_the_match(
        self, harness: Harness, database: Database
    ) -> None:
        match_id = harness.publish()
        market = first_market(harness, match_id)
        harness.client.post(
            f"/api/v1/admin/markets/{market['id']}/actions", json=SUSPEND, headers=WRITE
        )
        harness.rpc(
            "odds.setMatchMarketsStatus", {"matchId": match_id, "status": "OPEN"}
        )

        assert market_row(database, market["id"])["status"] == "SUSPENDED"

    def test_a_match_no_longer_open_for_betting_is_market_closed(
        self, harness: Harness, database: Database
    ) -> None:
        by_lifecycle = harness.publish()
        by_clock = harness.publish()
        by_status = harness.publish()
        unknown = harness.publish()
        harness.peers.match_directory.lifecycles[by_lifecycle] = "BETTING_CLOSED"
        harness.peers.match_directory.closes_in[by_clock] = timedelta(seconds=-1)
        harness.rpc(
            "odds.setMatchMarketsStatus", {"matchId": by_status, "status": "CLOSED"}
        )
        harness.peers.match_directory.unknown.add(unknown)

        for match_id in (by_lifecycle, by_clock, by_status, unknown):
            market = first_market(harness, match_id)
            before = market_row(database, market["id"])
            response = harness.client.post(
                f"/api/v1/admin/markets/{market['id']}/actions",
                json=SUSPEND,
                headers=WRITE,
            )

            assert response.status_code == 409, match_id
            assert response.json()["error"]["code"] == "MARKET_CLOSED"
            assert market_row(database, market["id"]) == before

        assert harness.peers.audit_recorder.entries == []

    def test_an_action_that_does_not_apply_is_a_conflict(
        self, harness: Harness
    ) -> None:
        market = first_market(harness, harness.publish())
        path = f"/api/v1/admin/markets/{market['id']}/actions"

        assert harness.client.post(path, json=RESUME, headers=WRITE).status_code == 409
        harness.client.post(path, json=SUSPEND, headers=WRITE)
        again = harness.client.post(path, json=SUSPEND, headers=WRITE)

        assert again.status_code == 409
        assert again.json()["error"]["code"] == "CONFLICT"

    def test_an_unknown_market_is_not_found(self, harness: Harness) -> None:
        response = harness.client.post(
            f"/api/v1/admin/markets/{uuid.uuid4()}/actions", json=SUSPEND, headers=WRITE
        )

        assert response.status_code == 404
        assert response.json()["error"]["code"] == "NOT_FOUND"

    @pytest.mark.parametrize(
        "body",
        [
            {"action": "SET_ODDS", "reason": "Make the home team longer"},
            {"action": "SUSPEND", "reason": "no"},
            {"action": "SUSPEND", "reason": "x" * 241},
            {"action": "SUSPEND", "reason": "Valid reason", "odds": 9.5},
            {"action": "SUSPEND", "reason": "Valid reason", "winner": "HOME"},
        ],
    )
    def test_there_is_no_action_that_sets_a_price_or_an_outcome(
        self, harness: Harness, body: dict[str, Any]
    ) -> None:
        market = first_market(harness, harness.publish())
        response = harness.client.post(
            f"/api/v1/admin/markets/{market['id']}/actions", json=body, headers=WRITE
        )

        assert response.status_code == 422
        assert response.json()["error"]["code"] == "VALIDATION_FAILED"

    def test_a_malformed_market_id_is_rejected(self, harness: Harness) -> None:
        response = harness.client.post(
            "/api/v1/admin/markets/1%20OR%201=1/actions", json=SUSPEND, headers=WRITE
        )

        assert response.status_code == 422


class TestAdminOdds:
    def test_lists_a_match_with_opening_prices_margin_and_exposure(
        self, harness: Harness
    ) -> None:
        match_id = harness.publish()
        market = first_market(harness, match_id)
        home = market["selections"][0]
        harness.peers.exposure_reader.by_id[home["id"]] = SelectionExposure(
            stake=250_000, liability=180_000
        )
        response = harness.client.get(
            "/api/v1/admin/odds", params={"matchId": match_id}, headers=READ
        )

        assert response.status_code == 200
        items = response.json()["items"]
        assert len(items) == 8
        first = items[0]
        assert set(first) == {
            "marketId",
            "matchId",
            "matchLabel",
            "leagueName",
            "marketType",
            "marketLabel",
            "status",
            "margin",
            "exposure",
            "selections",
            "updatedAt",
        }
        assert first["leagueName"] == "Test League"
        assert first["exposure"] == 180_000
        assert first["selections"][0] == {
            "selectionId": home["id"],
            "label": "LIO",
            "currentOdds": home["odds"],
            "openingOdds": home["odds"],
            "modelProbability": home["probability"],
            "stake": 250_000,
            "liability": 180_000,
        }
        assert 0 < first["margin"] < 0.5
        assert [i["marketLabel"] for i in items][2] == "Total Goals 1.5"

    def test_without_a_match_lists_markets_still_trading(
        self, harness: Harness
    ) -> None:
        trading = harness.publish()
        settled = harness.publish()
        harness.rpc(
            "odds.setMatchMarketsStatus", {"matchId": settled, "status": "SETTLED"}
        )
        items = harness.client.get("/api/v1/admin/odds", headers=READ).json()["items"]
        match_ids = {item["matchId"] for item in items}

        assert trading in match_ids
        assert settled not in match_ids
        assert len(items) <= 600

    def test_a_malformed_match_id_is_rejected(self, harness: Harness) -> None:
        response = harness.client.get(
            "/api/v1/admin/odds", params={"matchId": "nope"}, headers=READ
        )

        assert response.status_code == 422


class TestPricingConfiguration:
    BODY: dict[str, Any] = {  # noqa: RUF012
        "margins": {
            "MATCH_RESULT": 0.08,
            "DOUBLE_CHANCE": 0.07,
            "OVER_UNDER": 0.06,
            "BOTH_TEAMS_TO_SCORE": 0.06,
            "GOAL_SPREAD": 0.07,
            "CORRECT_SCORE": 0.15,
        },
        "minOdds": 1.01,
        "maxOdds": 500,
        "reason": "Widen the match result margin",
    }

    def test_get_returns_the_active_version(self, harness: Harness) -> None:
        body = harness.client.get("/api/v1/admin/odds/config", headers=READ).json()

        assert body["active"] is True
        assert body["version"] >= 1
        assert set(body["margins"]) == set(self.BODY["margins"])
        assert body["minOdds"] > 1
        assert body["maxOdds"] <= 1000

    def test_put_inserts_a_version_that_prices_later_markets_only(
        self, harness: Harness, database: Database
    ) -> None:
        earlier = harness.publish()
        before = harness.client.get("/api/v1/admin/odds/config", headers=READ).json()
        response = harness.client.put(
            "/api/v1/admin/odds/config", json=self.BODY, headers=WRITE
        )

        assert response.status_code == 200, response.text
        body = response.json()
        assert body["version"] == before["version"] + 1
        assert body["active"] is True
        assert body["margins"]["MATCH_RESULT"] == 0.08
        assert body["createdBy"] == WRITE["x-betng-actor-id"]

        active = database.execute(
            "SELECT version FROM odds.pricing_configurations WHERE active"
        ).fetchall()
        assert [row["version"] for row in active] == [body["version"]]

        [entry] = harness.peers.audit_recorder.entries
        assert entry.action == "odds_configuration_changed"
        assert entry.before["version"] == before["version"]
        assert entry.after["version"] == body["version"]

        later = harness.publish()
        versions = {
            str(row["match_id"]): row["pricing_version"]
            for row in database.execute(
                "SELECT DISTINCT match_id, pricing_version FROM odds.markets "
                "WHERE match_id = ANY(%s::uuid[])",
                ([earlier, later],),
            ).fetchall()
        }
        assert versions == {earlier: before["version"], later: body["version"]}

    def test_an_audit_failure_leaves_the_configuration_unchanged(
        self, harness: Harness
    ) -> None:
        before = harness.client.get("/api/v1/admin/odds/config", headers=READ).json()
        harness.peers.audit_recorder.fail = True
        response = harness.client.put(
            "/api/v1/admin/odds/config", json=self.BODY, headers=WRITE
        )

        assert response.status_code == 503
        after = harness.client.get("/api/v1/admin/odds/config", headers=READ).json()
        assert after == before

    @pytest.mark.parametrize(
        "change",
        [
            {"margins": {"MATCH_RESULT": 0.07}},
            {"margins": {**BODY["margins"], "MATCH_RESULT": -0.01}},
            {"margins": {**BODY["margins"], "MATCH_RESULT": 0.9}},
            {"margins": {**BODY["margins"], "HANDICAP": 0.05}},
            {"minOdds": 1.0},
            {"maxOdds": 5000},
            {"minOdds": 20, "maxOdds": 10},
            {"reason": ""},
            {"createdBy": "someone-else"},
        ],
    )
    def test_an_invalid_configuration_is_rejected(
        self, harness: Harness, change: dict[str, Any]
    ) -> None:
        response = harness.client.put(
            "/api/v1/admin/odds/config", json={**self.BODY, **change}, headers=WRITE
        )

        assert response.status_code == 422
        assert response.json()["error"]["code"] == "VALIDATION_FAILED"
