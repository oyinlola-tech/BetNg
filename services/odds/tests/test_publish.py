from __future__ import annotations

import logging
import uuid
from decimal import Decimal
from typing import Any

import psycopg
import pytest
from betng_service_kit import RpcClient
from fastapi.testclient import TestClient

from betng_odds import PeerOverrides, create_app
from betng_odds.dtos import (
    MarketAdminActionRequest,
    PublishMarketsRequest,
    RequestModel,
    SetMatchMarketsStatusRequest,
    TeamStrength,
    UpdatePricingConfigurationRequest,
)
from betng_odds.pricing import overround
from betng_odds.repositories import RpcProbabilityModel
from conftest import STRENGTH, Harness, build_settings

Database = psycopg.Connection[dict[str, Any]]


def rows(database: Database, sql: str, *params: Any) -> list[dict[str, Any]]:
    return database.execute(sql, params).fetchall()


class TestPublishMarkets:
    def test_creates_every_market_at_version_one_with_an_initial_snapshot(
        self, harness: Harness, database: Database
    ) -> None:
        match_id = str(uuid.uuid4())
        body = harness.rpc(
            "odds.publishMarkets",
            {"matchId": match_id, "home": STRENGTH, "away": STRENGTH},
        )

        assert body["result"] == {"matchId": match_id, "markets": 8, "oddsVersion": 1}

        markets = rows(
            database,
            "SELECT type, line, status, odds_version FROM odds.markets "
            "WHERE match_id = %s ORDER BY sort_order",
            match_id,
        )
        assert [(m["type"], m["line"]) for m in markets] == [
            ("MATCH_RESULT", None),
            ("DOUBLE_CHANCE", None),
            ("OVER_UNDER", Decimal("1.5")),
            ("OVER_UNDER", Decimal("2.5")),
            ("OVER_UNDER", Decimal("3.5")),
            ("BOTH_TEAMS_TO_SCORE", None),
            ("GOAL_SPREAD", Decimal("-1.5")),
            ("CORRECT_SCORE", None),
        ]
        assert {(m["status"], m["odds_version"]) for m in markets} == {("OPEN", 1)}

        selections = rows(
            database,
            "SELECT count(*) AS n FROM odds.market_selections WHERE match_id = %s",
            match_id,
        )
        assert selections[0]["n"] == 3 + 3 + 2 * 3 + 2 + 2 + 17

        snapshots = rows(
            database,
            "SELECT odds_version, reason, jsonb_array_length(prices) AS prices "
            "FROM odds.odds_snapshots WHERE match_id = %s",
            match_id,
        )
        assert len(snapshots) == 8
        assert {(s["odds_version"], s["reason"]) for s in snapshots} == {(1, "INITIAL")}

    def test_prices_carry_the_active_configuration_margin(
        self, harness: Harness, database: Database
    ) -> None:
        match_id = harness.publish()
        margins = rows(
            database, "SELECT margins FROM odds.pricing_configurations WHERE active"
        )[0]["margins"]
        prices = rows(
            database,
            "SELECT m.type, s.odds, s.probability FROM odds.market_selections s "
            "JOIN odds.markets m ON m.id = s.market_id "
            "WHERE m.match_id = %s AND m.type = 'MATCH_RESULT'",
            match_id,
        )
        measured = overround(
            [p["odds"] for p in prices], [p["probability"] for p in prices]
        )

        assert abs(measured - Decimal(str(margins["MATCH_RESULT"]))) < Decimal("0.006")

    def test_is_idempotent(self, harness: Harness, database: Database) -> None:
        match_id = harness.publish()
        sql = (
            "SELECT s.id, s.odds, m.odds_version, m.updated_at "
            "FROM odds.market_selections s JOIN odds.markets m ON m.id = s.market_id "
            "WHERE s.match_id = %s ORDER BY s.id"
        )
        first = rows(database, sql, match_id)
        database.commit()

        body = harness.rpc(
            "odds.publishMarkets",
            {"matchId": match_id, "home": STRENGTH, "away": STRENGTH},
        )

        assert body["result"] == {"matchId": match_id, "markets": 8, "oddsVersion": 1}
        assert rows(database, sql, match_id) == first
        assert harness.peers.probability_model.calls == 1
        assert (
            rows(
                database,
                "SELECT count(*) AS n FROM odds.odds_snapshots WHERE match_id = %s",
                match_id,
            )[0]["n"]
            == 8
        )

    def test_every_caller_reads_the_same_odds(self, harness: Harness) -> None:
        match_id = harness.publish()
        path = f"/api/v1/matches/{match_id}/odds"
        anonymous = harness.client.get(path).json()
        customer = harness.client.get(
            path,
            headers={
                "x-betng-actor-kind": "CUSTOMER",
                "x-betng-actor-id": str(uuid.uuid4()),
            },
        ).json()

        assert anonymous["markets"] == customer["markets"]

    def test_an_unknown_match_is_not_priced(
        self, harness: Harness, database: Database
    ) -> None:
        match_id = str(uuid.uuid4())
        harness.peers.match_directory.unknown.add(match_id)
        body = harness.rpc(
            "odds.publishMarkets",
            {"matchId": match_id, "home": STRENGTH, "away": STRENGTH},
        )

        assert body["success"] is False
        assert body["error"]["code"] == "NOT_FOUND"
        assert (
            rows(database, "SELECT 1 FROM odds.markets WHERE match_id = %s", match_id)
            == []
        )

    def test_an_unreachable_simulation_service_is_odds_unavailable(
        self, database_url: str, harness: Harness, database: Database
    ) -> None:
        unreachable = RpcProbabilityModel(
            client=RpcClient("http://127.0.0.1:9", "simulation", 500),
            health_url="http://127.0.0.1:9/health",
            timeout_seconds=0.5,
            logger=logging.getLogger("test"),
        )
        app = create_app(
            build_settings(),
            overrides=PeerOverrides(
                probability_model=unreachable,
                match_directory=harness.peers.match_directory,
            ),
        )
        match_id = str(uuid.uuid4())

        with TestClient(app) as client:
            body = client.post(
                "/rpc",
                json={
                    "id": "1",
                    "procedure": "odds.publishMarkets",
                    "payload": {
                        "matchId": match_id,
                        "home": STRENGTH,
                        "away": STRENGTH,
                    },
                    "metadata": {},
                    "timestamp": 0,
                },
            ).json()
            ready = client.get("/ready")

        assert body["success"] is False
        assert body["error"]["code"] == "ODDS_UNAVAILABLE"
        assert "127.0.0.1" not in body["error"]["message"]
        assert ready.status_code == 503
        assert "127.0.0.1" not in ready.text
        assert (
            rows(database, "SELECT 1 FROM odds.markets WHERE match_id = %s", match_id)
            == []
        )

    @pytest.mark.parametrize(
        "payload",
        [
            {"matchId": "not-a-uuid", "home": STRENGTH, "away": STRENGTH},
            {
                "matchId": str(uuid.uuid4()),
                "home": {**STRENGTH, "attack": 101},
                "away": STRENGTH,
            },
            {"matchId": str(uuid.uuid4()), "home": STRENGTH},
            {
                "matchId": str(uuid.uuid4()),
                "home": STRENGTH,
                "away": STRENGTH,
                "userId": "u1",
            },
            {
                "matchId": str(uuid.uuid4()),
                "home": STRENGTH,
                "away": STRENGTH,
                "stake": 100,
            },
        ],
    )
    def test_rejects_a_payload_outside_the_contract(
        self, harness: Harness, payload: dict[str, Any]
    ) -> None:
        body = harness.rpc("odds.publishMarkets", payload)

        assert body["success"] is False
        assert body["error"]["code"] == "RPC_VALIDATION_ERROR"

    def test_the_old_scaffold_procedures_are_gone(self, harness: Harness) -> None:
        for procedure in ("odds.calculateOdds", "odds.getMatchOdds"):
            assert (
                harness.rpc(procedure, {})["error"]["code"] == "RPC_PROCEDURE_NOT_FOUND"
            )


class TestNoUserParameter:
    def test_no_request_model_has_a_bettor_field(self) -> None:
        forbidden = ("user", "customer", "actor", "shop", "cashier", "stake", "bettor")
        models: list[type[RequestModel]] = [
            TeamStrength,
            PublishMarketsRequest,
            SetMatchMarketsStatusRequest,
            MarketAdminActionRequest,
            UpdatePricingConfigurationRequest,
        ]

        for model in models:
            assert model.model_config.get("extra") == "forbid"

            for name, info in model.model_fields.items():
                for word in forbidden:
                    assert word not in name.lower(), (model.__name__, name)
                    assert word not in (info.alias or "").lower()

    def test_the_public_routes_take_only_match_ids(self, harness: Harness) -> None:
        paths = harness.client.get("/openapi.json").json()["paths"]

        def parameters(path: str) -> set[str]:
            return {p["name"] for p in paths[path]["get"].get("parameters", [])}

        assert parameters("/api/v1/matches/{match_id}/odds") == {"match_id"}
        assert parameters("/api/v1/odds") == {"matchIds"}


class TestSnapshotImmutability:
    def test_update_delete_and_truncate_are_rejected(
        self, harness: Harness, database: Database
    ) -> None:
        match_id = harness.publish()

        for statement in (
            "UPDATE odds.odds_snapshots SET prices = '[]' WHERE match_id = %s",
            "DELETE FROM odds.odds_snapshots WHERE match_id = %s",
        ):
            with pytest.raises(psycopg.errors.RestrictViolation):
                database.execute(statement, (match_id,))
            database.rollback()

        with pytest.raises(psycopg.errors.RestrictViolation):
            database.execute("TRUNCATE odds.odds_snapshots")
        database.rollback()

        assert (
            rows(
                database,
                "SELECT count(*) AS n FROM odds.odds_snapshots WHERE match_id = %s",
                match_id,
            )[0]["n"]
            == 8
        )

    def test_a_version_cannot_be_snapshotted_twice(
        self, harness: Harness, database: Database
    ) -> None:
        match_id = harness.publish()

        with pytest.raises(psycopg.errors.UniqueViolation):
            database.execute(
                "INSERT INTO odds.odds_snapshots "
                "(id, market_id, match_id, odds_version, reason, status, prices) "
                "SELECT gen_random_uuid(), id, match_id, 1, 'INITIAL', status, '[]' "
                "FROM odds.markets WHERE match_id = %s",
                (match_id,),
            )
        database.rollback()


class TestSetMatchMarketsStatus:
    def test_moves_every_market_bumps_the_version_and_snapshots(
        self, harness: Harness, database: Database
    ) -> None:
        match_id = harness.publish()
        body = harness.rpc(
            "odds.setMatchMarketsStatus", {"matchId": match_id, "status": "CLOSED"}
        )

        assert body["result"] == {"updated": 8}
        assert {
            (m["status"], m["odds_version"])
            for m in rows(
                database,
                "SELECT status, odds_version FROM odds.markets WHERE match_id = %s",
                match_id,
            )
        } == {("CLOSED", 2)}
        assert {
            (s["odds_version"], s["reason"], s["status"])
            for s in rows(
                database,
                "SELECT odds_version, reason, status FROM odds.odds_snapshots "
                "WHERE match_id = %s",
                match_id,
            )
        } == {(1, "INITIAL", "OPEN"), (2, "STATUS_CHANGE", "CLOSED")}

    def test_a_repeat_changes_nothing(self, harness: Harness) -> None:
        match_id = harness.publish()
        payload = {"matchId": match_id, "status": "CLOSED"}

        assert harness.rpc("odds.setMatchMarketsStatus", payload)["result"] == {
            "updated": 8
        }
        assert harness.rpc("odds.setMatchMarketsStatus", payload)["result"] == {
            "updated": 0
        }

    def test_follows_the_lifecycle_to_settled_and_void(self, harness: Harness) -> None:
        match_id = harness.publish()

        for status in ("CLOSED", "SETTLED", "VOID"):
            body = harness.rpc(
                "odds.setMatchMarketsStatus", {"matchId": match_id, "status": status}
            )
            assert body["result"] == {"updated": 8}

        odds = harness.client.get(f"/api/v1/matches/{match_id}/odds").json()
        assert {(m["status"], m["oddsVersion"]) for m in odds["markets"]} == {
            ("VOID", 4)
        }
        # VOID is terminal.
        assert harness.rpc(
            "odds.setMatchMarketsStatus", {"matchId": match_id, "status": "OPEN"}
        )["result"] == {"updated": 0}

    def test_rejects_a_status_the_match_service_may_not_set(
        self, harness: Harness
    ) -> None:
        body = harness.rpc(
            "odds.setMatchMarketsStatus",
            {"matchId": str(uuid.uuid4()), "status": "SUSPENDED"},
        )

        assert body["error"]["code"] == "RPC_VALIDATION_ERROR"
