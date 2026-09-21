from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Any

import psycopg
from fastapi.testclient import TestClient

from conftest import Book, evaluate_payload, rpc


def decision_row(
    superuser: psycopg.Connection[Any], decision_id: str
) -> dict[str, Any]:
    row = superuser.execute(
        "SELECT * FROM risk.risk_decisions WHERE id = %s", (decision_id,)
    ).fetchone()
    assert row is not None
    return dict(row)


class TestEvaluate:
    def test_accepts_and_stores_the_decision_with_the_metadata_request_id(
        self, client: TestClient, book: Book, superuser: psycopg.Connection[Any]
    ) -> None:
        match = book.match()
        market = book.market(match)
        actor_id, request_id = str(uuid.uuid4()), f"trace-{uuid.uuid4()}"

        body = rpc(
            client,
            "risk.evaluate",
            evaluate_payload(100_000, [(market, "HOME")], actor_id=actor_id),
            request_id,
        )

        assert body["success"] is True
        assert set(body["result"]) == {"decisionId", "decision", "reason", "maxStake"}
        assert body["result"]["decision"] == "ACCEPT"
        assert body["result"]["reason"] == "WITHIN_LIMIT"
        assert body["result"]["maxStake"] == 50_000_000

        row = decision_row(superuser, body["result"]["decisionId"])
        assert row["request_id"] == request_id
        assert row["actor_kind"] == "CUSTOMER"
        assert str(row["actor_id"]) == actor_id
        assert row["shop_id"] is None
        assert row["stake_requested"] == 100_000
        assert str(row["total_odds"]) == "2.00"
        assert (row["decision"], row["reason"]) == ("ACCEPT", "WITHIN_LIMIT")
        assert row["max_stake"] == 50_000_000
        assert row["limits_version"] >= 1
        assert row["legs"] == [
            {
                "matchId": match.id,
                "marketId": market.id,
                "selectionId": market.selections["HOME"].id,
                "odds": "2.00",
            }
        ]

    def test_stores_a_cashier_with_the_shop(
        self, client: TestClient, book: Book, superuser: psycopg.Connection[Any]
    ) -> None:
        market = book.market(book.match())
        shop_id = str(uuid.uuid4())
        payload = evaluate_payload(100_000, [(market, "HOME")])
        payload["actor"] = {
            "kind": "CASHIER",
            "id": str(uuid.uuid4()),
            "shopId": shop_id,
        }

        body = rpc(client, "risk.evaluate", payload)

        row = decision_row(superuser, body["result"]["decisionId"])
        assert row["actor_kind"] == "CASHIER"
        assert str(row["shop_id"]) == shop_id

    def test_stores_rejections_too(
        self, client: TestClient, book: Book, superuser: psycopg.Connection[Any]
    ) -> None:
        match = book.match()
        market = book.market(match)
        book.set_market_status(market, "SUSPENDED")

        body = rpc(
            client, "risk.evaluate", evaluate_payload(100_000, [(market, "HOME")])
        )

        assert body["result"]["decision"] == "REJECT"
        assert body["result"]["reason"] == "MARKET_SUSPENDED"
        assert body["result"]["maxStake"] == 0
        row = decision_row(superuser, body["result"]["decisionId"])
        assert (row["decision"], row["reason"], row["max_stake"]) == (
            "REJECT",
            "MARKET_SUSPENDED",
            0,
        )

    def test_every_evaluation_adds_one_row(
        self, client: TestClient, book: Book, superuser: psycopg.Connection[Any]
    ) -> None:
        market = book.market(book.match())
        request_id = f"trace-{uuid.uuid4()}"

        for stake in (100_000, 1_000, 60_000_000):
            rpc(
                client,
                "risk.evaluate",
                evaluate_payload(stake, [(market, "HOME")]),
                request_id,
            )

        rows = superuser.execute(
            "SELECT decision, reason FROM risk.risk_decisions "
            "WHERE request_id = %s ORDER BY stake_requested",
            (request_id,),
        ).fetchall()
        assert [(row["decision"], row["reason"]) for row in rows] == [
            ("REJECT", "STAKE_BELOW_MINIMUM"),
            ("ACCEPT", "WITHIN_LIMIT"),
            ("LIMIT", "STAKE_LIMIT"),
        ]

    def test_rejects_a_closed_match(self, client: TestClient, book: Book) -> None:
        market = book.market(book.match(lifecycle="BETTING_CLOSED"))

        body = rpc(
            client, "risk.evaluate", evaluate_payload(100_000, [(market, "HOME")])
        )

        assert body["result"]["reason"] == "MARKET_CLOSED"

    def test_rejects_once_the_closing_instant_has_passed(
        self, client: TestClient, book: Book
    ) -> None:
        market = book.market(book.match(closes_in=timedelta(seconds=-1)))

        body = rpc(
            client, "risk.evaluate", evaluate_payload(100_000, [(market, "HOME")])
        )

        assert body["result"]["reason"] == "MARKET_CLOSED"

    def test_rejects_an_unknown_selection(self, client: TestClient, book: Book) -> None:
        market = book.market(book.match())
        payload = evaluate_payload(100_000, [(market, "HOME")])
        payload["legs"][0]["selectionId"] = str(uuid.uuid4())

        body = rpc(client, "risk.evaluate", payload)

        assert body["result"]["decision"] == "REJECT"
        assert body["result"]["reason"] == "INVALID_SELECTION"

    def test_rejects_a_selection_claimed_under_another_market(
        self, client: TestClient, book: Book
    ) -> None:
        match = book.match()
        market, other = book.market(match), book.market(match)
        payload = evaluate_payload(100_000, [(market, "HOME")])
        payload["legs"][0]["marketId"] = other.id

        body = rpc(client, "risk.evaluate", payload)

        assert body["result"]["reason"] == "INVALID_SELECTION"

    def test_a_multi_leg_slip_is_decided_on_its_total_odds(
        self, client: TestClient, book: Book, superuser: psycopg.Connection[Any]
    ) -> None:
        first, second = book.market(book.match()), book.market(book.match())

        body = rpc(
            client,
            "risk.evaluate",
            evaluate_payload(100_000, [(first, "HOME"), (second, "AWAY")]),
        )

        assert body["result"]["decision"] == "ACCEPT"
        row = decision_row(superuser, body["result"]["decisionId"])
        assert str(row["total_odds"]) == "7.60"
        assert len(row["legs"]) == 2


class TestEvaluateValidation:
    def invalid(self, client: TestClient, payload: Any) -> None:
        body = rpc(client, "risk.evaluate", payload)
        assert body["success"] is False
        assert body["error"]["code"] == "RPC_VALIDATION_ERROR"

    def test_refuses_no_legs(self, client: TestClient) -> None:
        self.invalid(client, {**evaluate_payload(100_000, []), "legs": []})

    def test_refuses_more_than_twenty_legs(
        self, client: TestClient, book: Book
    ) -> None:
        market = book.market(book.match())
        self.invalid(client, evaluate_payload(100_000, [(market, "HOME")] * 21))

    def test_refuses_a_zero_stake(self, client: TestClient, book: Book) -> None:
        market = book.market(book.match())
        self.invalid(client, evaluate_payload(0, [(market, "HOME")]))

    def test_refuses_a_fractional_stake(self, client: TestClient, book: Book) -> None:
        market = book.market(book.match())
        self.invalid(
            client, {**evaluate_payload(1, [(market, "HOME")]), "stake": 100.5}
        )

    def test_refuses_odds_of_one_or_less(self, client: TestClient, book: Book) -> None:
        market = book.market(book.match())
        payload = evaluate_payload(100_000, [(market, "HOME")])
        payload["legs"][0]["odds"] = 1
        self.invalid(client, payload)

    def test_refuses_odds_with_more_than_two_places(
        self, client: TestClient, book: Book
    ) -> None:
        market = book.market(book.match())
        payload = evaluate_payload(100_000, [(market, "HOME")])
        payload["legs"][0]["odds"] = 2.005
        self.invalid(client, payload)

    def test_refuses_an_admin_actor(self, client: TestClient, book: Book) -> None:
        market = book.market(book.match())
        payload = evaluate_payload(100_000, [(market, "HOME")])
        payload["actor"]["kind"] = "ADMIN"
        self.invalid(client, payload)

    def test_refuses_unknown_keys(self, client: TestClient, book: Book) -> None:
        market = book.market(book.match())
        payload = {**evaluate_payload(100_000, [(market, "HOME")]), "maxStake": 1}
        self.invalid(client, payload)

    def test_refuses_an_id_that_is_not_a_uuid(
        self, client: TestClient, book: Book
    ) -> None:
        market = book.market(book.match())
        payload = evaluate_payload(100_000, [(market, "HOME")])
        payload["legs"][0]["matchId"] = "1; DROP TABLE risk.risk_limits"
        self.invalid(client, payload)


class TestFreezeExposure:
    def test_stores_the_snapshot_and_the_first_freeze_wins(
        self, client: TestClient, book: Book, superuser: psycopg.Connection[Any]
    ) -> None:
        match = book.match(lifecycle="BETTING_CLOSED", status="BETTING_CLOSED")
        market = book.market(match, status="CLOSED")
        book.bet(100_000, [(match, market, "HOME")], user_id=str(uuid.uuid4()))

        first = rpc(client, "risk.freezeExposure", {"matchId": match.id})
        assert first["success"] is True
        assert first["result"]["matchId"] == match.id

        # A bet that appears after the freeze must not change the snapshot.
        book.bet(900_000, [(match, market, "HOME")], user_id=str(uuid.uuid4()))
        second = rpc(client, "risk.freezeExposure", {"matchId": match.id})

        assert second["result"] == first["result"]
        rows = superuser.execute(
            "SELECT snapshot FROM risk.exposure_freezes WHERE match_id = %s",
            (match.id,),
        ).fetchall()
        assert len(rows) == 1
        assert rows[0]["snapshot"]["totalStake"] == 100_000
        assert rows[0]["snapshot"]["matchId"] == match.id

    def test_a_frozen_match_reports_the_snapshot_as_frozen(
        self, client: TestClient, book: Book
    ) -> None:
        match = book.match(lifecycle="BETTING_CLOSED", status="BETTING_CLOSED")
        market = book.market(match, status="CLOSED")
        book.bet(100_000, [(match, market, "HOME")], user_id=str(uuid.uuid4()))
        frozen = rpc(client, "risk.freezeExposure", {"matchId": match.id})
        book.bet(900_000, [(match, market, "HOME")], user_id=str(uuid.uuid4()))

        body = client.get(f"/internal/risk/matches/{match.id}/exposure").json()

        assert body["status"] == "FROZEN"
        assert body["frozenAt"] == frozen["result"]["frozenAt"]
        assert body["totalStake"] == 100_000
        assert body["bets"] == 1

    def test_a_frozen_match_takes_no_more_stakes(
        self, client: TestClient, book: Book
    ) -> None:
        match = book.match()
        market = book.market(match)
        rpc(client, "risk.freezeExposure", {"matchId": match.id})

        body = rpc(
            client, "risk.evaluate", evaluate_payload(100_000, [(market, "HOME")])
        )

        assert body["result"]["decision"] == "REJECT"
        assert body["result"]["reason"] == "MARKET_CLOSED"

    def test_an_unknown_match_is_refused(self, client: TestClient) -> None:
        body = rpc(client, "risk.freezeExposure", {"matchId": str(uuid.uuid4())})

        assert body["success"] is False
        assert body["error"]["code"] == "NOT_FOUND"

    def test_a_malformed_match_id_is_refused(self, client: TestClient) -> None:
        body = rpc(client, "risk.freezeExposure", {"matchId": "nope"})

        assert body["error"]["code"] == "RPC_VALIDATION_ERROR"


class TestRiskCannotAct:
    def test_the_old_scaffold_procedures_are_gone(self, client: TestClient) -> None:
        for procedure in ("risk.calculateExposure", "risk.calculateLiability"):
            body = rpc(client, procedure, {})
            assert body["error"]["code"] == "RPC_PROCEDURE_NOT_FOUND"

    def test_no_procedure_changes_a_bet_a_price_or_a_result(
        self, client: TestClient
    ) -> None:
        for procedure in (
            "risk.suspendMarket",
            "risk.adjustOdds",
            "risk.voidBet",
            "risk.setResult",
        ):
            body = rpc(client, procedure, {})
            assert body["error"]["code"] == "RPC_PROCEDURE_NOT_FOUND"
