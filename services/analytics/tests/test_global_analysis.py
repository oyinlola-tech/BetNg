from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

from conftest import REPORTS_ADMIN, Bet, Book, Match


def overview(client: TestClient, book: Book) -> dict[str, Any]:
    response = client.get(
        "/api/v1/admin/analytics/overview", params=book.window, headers=REPORTS_ADMIN
    )
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


def six_bets_on_one_match(book: Book) -> tuple[Match, list[Bet]]:
    match = book.match(book.league(), status="COMPLETED", result=(2, 1))
    shop_1, shop_2 = book.shop("Ikeja"), book.shop("Surulere")
    till_1, till_2 = book.cashier(shop_1), book.cashier(shop_2, "Till Two")

    bets = [
        book.bet(match, "HOME", 100_000, "WON", customer=book.customer("One")),
        book.bet(match, "HOME", 50_000, "WON", customer=book.customer("Two")),
        book.bet(
            match, "DRAW", 30_000, "LOST", odds="3.40", customer=book.customer("Three")
        ),
        book.bet(
            match, "AWAY", 70_000, "LOST", odds="3.80", customer=book.customer("Four")
        ),
        book.bet(match, "HOME", 40_000, "WON", cashier=till_1),
        book.bet(match, "AWAY", 25_000, "LOST", odds="3.80", cashier=till_2),
    ]

    return match, bets


class TestGlobalBetAnalysis:
    def test_covers_every_bet_from_every_account_and_shop(
        self, client: TestClient, book: Book
    ) -> None:
        _, bets = six_bets_on_one_match(book)
        stakes = sum(bet.stake for bet in bets)
        payouts = sum(bet.payout or 0 for bet in bets if bet.status == "WON")

        body = overview(client, book)

        assert body["totalBets"] == 6
        assert body["acceptedBets"] == 6
        assert body["totalStake"] == stakes == 315_000
        assert body["settledStake"] == stakes
        assert body["totalPayout"] == payouts == 399_000
        assert body["operatorResult"] == stakes - payouts
        assert body["winningBets"] == 3
        assert body["losingBets"] == 3
        assert body["settledBets"] == 6
        assert body["pendingBets"] == 0
        assert body["totalMatches"] == 1
        assert body["customers"] == 4
        assert body["shops"] == 2
        assert body["cashiers"] == 2

    def test_reconciles_with_the_settlement_rows(
        self, client: TestClient, book: Book
    ) -> None:
        _, bets = six_bets_on_one_match(book)

        settled = book.connection.execute(
            "SELECT COALESCE(SUM(payout), 0)::bigint AS payout "
            "FROM settlement.settlements "
            "WHERE outcome = 'WON' AND bet_id::text = ANY(%s)",
            ([bet.id for bet in bets],),
        ).fetchone()
        assert settled is not None

        body = overview(client, book)
        assert body["totalPayout"] == settled[0]

        response = client.get("/internal/analytics/operator", params=book.window)
        assert response.status_code == 200, response.text
        operator = response.json()

        assert operator["reconciled"] is True
        assert operator["bets"] == operator["settlements"] == operator["ledger"]
        assert operator["settlements"]["grossPayouts"] == body["totalPayout"]
        assert operator["summary"]["grossStakes"] == body["settledStake"]
        assert operator["summary"]["operatorResult"] == body["operatorResult"]
        assert operator["summary"]["settledBets"] == 6
        assert operator["summary"]["period"]["kind"] == "CUSTOM"

    def test_reports_a_ledger_that_disagrees_as_unreconciled(
        self, client: TestClient, book: Book
    ) -> None:
        _, bets = six_bets_on_one_match(book)
        book.connection.execute(
            "UPDATE settlement.operator_ledger_entries SET payout = payout + 1 "
            "WHERE settlement_id = %s",
            (bets[0].settlement_id,),
        )

        operator = client.get("/internal/analytics/operator", params=book.window).json()

        assert operator["reconciled"] is False
        assert (
            operator["ledger"]["grossPayouts"] == operator["bets"]["grossPayouts"] + 1
        )

    def test_counts_limited_and_rejected_stakes_from_risk_decisions(
        self, client: TestClient, book: Book
    ) -> None:
        match, _ = six_bets_on_one_match(book)
        book.risk_decision(match, "LIMIT")
        book.risk_decision(match, "REJECT")
        book.risk_decision(match, "REJECT")
        book.risk_decision(match, "ACCEPT")

        body = overview(client, book)

        assert body["limitedBets"] == 1
        assert body["rejectedBets"] == 2
        assert body["totalBets"] == 6


class TestRealisedFiguresOnly:
    def test_pending_void_and_cancelled_bets_stay_out_of_the_result(
        self, client: TestClient, book: Book
    ) -> None:
        match = book.match(book.league(), status="COMPLETED", result=(2, 1))
        won = book.bet(match, "HOME", 10_000, "WON", customer=book.customer())
        lost = book.bet(match, "AWAY", 20_000, "LOST", customer=book.customer())
        pending = book.bet(match, "HOME", 40_000, "PENDING", customer=book.customer())
        void = book.bet(match, "DRAW", 80_000, "VOID", customer=book.customer())
        book.bet(match, "DRAW", 160_000, "CANCELLED", customer=book.customer())

        body = overview(client, book)

        assert body["totalBets"] == 5
        assert body["pendingBets"] == 1
        assert body["voidBets"] == 1
        assert body["cancelledBets"] == 1
        assert body["settledBets"] == 3
        assert body["totalStake"] == 10_000 + 20_000 + 40_000 + 80_000
        assert body["pendingStake"] == pending.stake
        assert body["settledStake"] == won.stake + lost.stake
        assert body["totalPayout"] == won.payout
        assert body["operatorResult"] == won.stake + lost.stake - (won.payout or 0)
        # The void bet's refund is stored as a payout on the row; it is not one.
        assert void.payout == void.stake

    def test_a_negative_operator_result_is_reported_as_it_is(
        self, client: TestClient, book: Book
    ) -> None:
        match = book.match(book.league())
        won = book.bet(
            match, "HOME", 100_000, "WON", odds="5.00", customer=book.customer()
        )
        lost = book.bet(match, "AWAY", 10_000, "LOST", customer=book.customer())

        body = overview(client, book)

        assert won.payout == 500_000
        assert body["operatorResult"] == won.stake + lost.stake - 500_000 == -390_000
        assert body["operatorResultRate"] == round(-390_000 / 110_000, 6)

        operator = client.get("/internal/analytics/operator", params=book.window).json()
        assert operator["summary"]["operatorResult"] == -390_000
        assert operator["reconciled"] is True

    def test_an_empty_window_has_a_zero_rate_not_an_error(
        self, client: TestClient, book: Book
    ) -> None:
        body = overview(client, book)

        assert body["totalBets"] == 0
        assert body["operatorResult"] == 0
        assert body["operatorResultRate"] == 0
