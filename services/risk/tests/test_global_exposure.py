from __future__ import annotations

import uuid
from typing import Any

import psycopg
from fastapi.testclient import TestClient

from conftest import Book, evaluate_payload, force_limits, rpc

NAIRA = 100


def exposure(client: TestClient, match_id: str) -> dict[str, Any]:
    response = client.get(f"/internal/risk/matches/{match_id}/exposure")
    assert response.status_code == 200
    return dict(response.json())


def home_row(body: dict[str, Any]) -> dict[str, Any]:
    (market,) = body["markets"]
    return next(row for row in market["selections"] if row["code"] == "HOME")


class TestExposureIsGlobal:
    def test_a_fifth_user_sees_the_stakes_of_the_other_four(
        self, client: TestClient, book: Book, superuser: psycopg.Connection[Any]
    ) -> None:
        # At 2.00 every kobo staked adds one kobo of liability, so the largest
        # stake left on HOME is the selection limit minus what is already on it.
        force_limits(superuser, max_liability_per_selection=10_000 * NAIRA)
        match = book.match()
        market = book.market(match)
        fifth_user = str(uuid.uuid4())

        def max_stake() -> int:
            body = rpc(
                client,
                "risk.evaluate",
                evaluate_payload(100 * NAIRA, [(market, "HOME")], actor_id=fifth_user),
            )
            assert body["success"] is True
            assert body["result"]["decision"] == "ACCEPT"
            return int(body["result"]["maxStake"])

        seen = [max_stake()]
        for stake in (500, 1_000, 2_000, 500):
            book.bet(
                stake * NAIRA, [(match, market, "HOME")], user_id=str(uuid.uuid4())
            )
            seen.append(max_stake())

        assert seen == [
            10_000 * NAIRA,
            9_500 * NAIRA,
            8_500 * NAIRA,
            6_500 * NAIRA,
            6_000 * NAIRA,
        ]

        home = home_row(exposure(client, match.id))
        assert home["totalStake"] == 4_000 * NAIRA
        assert home["potentialPayout"] == 8_000 * NAIRA
        assert home["bets"] == 4
        assert home["customers"] == 4
        assert home["shops"] == 0

    def test_the_fifth_user_is_limited_by_exposure_they_did_not_create(
        self, client: TestClient, book: Book, superuser: psycopg.Connection[Any]
    ) -> None:
        force_limits(superuser, max_liability_per_selection=10_000 * NAIRA)
        match = book.match()
        market = book.market(match)
        for stake in (500, 1_000, 2_000, 500):
            book.bet(
                stake * NAIRA, [(match, market, "HOME")], user_id=str(uuid.uuid4())
            )

        body = rpc(
            client, "risk.evaluate", evaluate_payload(7_000 * NAIRA, [(market, "HOME")])
        )

        assert body["result"]["decision"] == "LIMIT"
        assert body["result"]["reason"] == "EXPOSURE_LIMIT"
        assert body["result"]["maxStake"] == 6_000 * NAIRA

    def test_online_and_shop_bets_share_one_book(
        self, client: TestClient, book: Book
    ) -> None:
        match = book.match()
        market = book.market(match)
        shop_a, shop_b = str(uuid.uuid4()), str(uuid.uuid4())
        customer = str(uuid.uuid4())

        book.bet(1_000 * NAIRA, [(match, market, "HOME")], user_id=customer)
        book.bet(1_000 * NAIRA, [(match, market, "HOME")], user_id=customer)
        book.bet(2_000 * NAIRA, [(match, market, "HOME")], shop_id=shop_a)
        book.bet(3_000 * NAIRA, [(match, market, "HOME")], shop_id=shop_b)
        book.bet(5_000 * NAIRA, [(match, market, "AWAY")], shop_id=shop_b)

        body = exposure(client, match.id)
        home = home_row(body)

        assert home["totalStake"] == 7_000 * NAIRA
        assert home["bets"] == 4
        assert home["customers"] == 1
        assert home["shops"] == 2
        assert body["bets"] == 5
        assert body["totalStake"] == 12_000 * NAIRA

    def test_only_pending_bets_count(self, client: TestClient, book: Book) -> None:
        match = book.match()
        market = book.market(match)
        book.bet(1_000 * NAIRA, [(match, market, "HOME")], user_id=str(uuid.uuid4()))
        for status in ("WON", "LOST", "VOID", "CANCELLED"):
            book.bet(
                9_000 * NAIRA,
                [(match, market, "HOME")],
                user_id=str(uuid.uuid4()),
                status=status,
            )

        body = exposure(client, match.id)

        assert body["bets"] == 1
        assert home_row(body)["totalStake"] == 1_000 * NAIRA


class TestExposureFigures:
    def test_market_and_match_worst_case(self, client: TestClient, book: Book) -> None:
        match = book.match()
        result = book.market(match)
        btts = book.market(
            match, type="BOTH_TEAMS_TO_SCORE", prices={"YES": "1.80", "NO": "1.95"}
        )
        user = str(uuid.uuid4())

        book.bet(1_000 * NAIRA, [(match, result, "HOME")], user_id=user)  # pays 2,000
        book.bet(1_000 * NAIRA, [(match, result, "AWAY")], user_id=user)  # pays 3,800
        book.bet(2_000 * NAIRA, [(match, btts, "YES")], user_id=user)  # pays 3,600
        book.bet(3_000 * NAIRA, [(match, btts, "NO")], user_id=user)  # pays 5,850

        body = exposure(client, match.id)
        markets = {market["type"]: market for market in body["markets"]}
        nets = {
            row["code"]: row["netExposure"]
            for row in markets["MATCH_RESULT"]["selections"]
        }

        assert markets["MATCH_RESULT"]["totalStake"] == 2_000 * NAIRA
        assert nets == {"HOME": 0, "DRAW": -2_000 * NAIRA, "AWAY": 1_800 * NAIRA}
        assert markets["MATCH_RESULT"]["worstCaseExposure"] == 1_800 * NAIRA
        assert markets["BOTH_TEAMS_TO_SCORE"]["totalStake"] == 5_000 * NAIRA
        assert markets["BOTH_TEAMS_TO_SCORE"]["worstCaseExposure"] == 850 * NAIRA
        assert body["worstCaseExposure"] == 2_650 * NAIRA
        assert body["totalStake"] == 7_000 * NAIRA
        assert body["status"] == "NORMAL"
        assert body["matchLabel"] == match.label
        assert body["leagueName"] == match.league_name
        assert body["lifecycle"] == "BETTING_OPEN"
        assert "frozenAt" not in body

    def test_an_accumulator_counts_once_per_match_and_in_full_on_each_leg(
        self, client: TestClient, book: Book
    ) -> None:
        first, second = book.match(), book.match()
        first_market, second_market = book.market(first), book.market(second)
        book.bet(
            1_000 * NAIRA,
            [(first, first_market, "HOME"), (second, second_market, "AWAY")],
            user_id=str(uuid.uuid4()),
        )

        # 2.00 x 3.80 = 7.60: the slip would pay 7,600 if both legs won.
        for match in (first, second):
            body = exposure(client, match.id)
            (market,) = body["markets"]
            backed = next(row for row in market["selections"] if row["bets"] == 1)

            assert body["bets"] == 1
            assert body["totalStake"] == 1_000 * NAIRA
            assert backed["potentialPayout"] == 7_600 * NAIRA
            assert body["worstCaseExposure"] == 6_600 * NAIRA

    def test_status_follows_the_most_utilised_limit(
        self, client: TestClient, book: Book, superuser: psycopg.Connection[Any]
    ) -> None:
        match = book.match()
        market = book.market(match)
        book.bet(6_000 * NAIRA, [(match, market, "HOME")], user_id=str(uuid.uuid4()))

        force_limits(superuser, max_liability_per_selection=20_000 * NAIRA)
        assert exposure(client, match.id)["status"] == "NORMAL"

        force_limits(superuser, max_liability_per_selection=10_000 * NAIRA)
        assert exposure(client, match.id)["status"] == "ELEVATED"

        force_limits(superuser, max_liability_per_selection=7_000 * NAIRA)
        body = exposure(client, match.id)
        assert body["status"] == "CRITICAL"
        assert home_row(body)["status"] == "CRITICAL"

    def test_an_unknown_match_is_not_found(self, client: TestClient) -> None:
        response = client.get(f"/internal/risk/matches/{uuid.uuid4()}/exposure")

        assert response.status_code == 404
        assert response.json()["error"]["code"] == "NOT_FOUND"

    def test_a_malformed_match_id_is_refused(self, client: TestClient) -> None:
        response = client.get("/internal/risk/matches/not-a-uuid/exposure")

        assert response.status_code == 422
        assert response.json()["error"]["code"] == "VALIDATION_FAILED"
