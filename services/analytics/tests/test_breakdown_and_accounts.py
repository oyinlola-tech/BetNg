from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from conftest import REPORTS_ADMIN, Book, Cashier, new_id

DIMENSIONS = [
    "league",
    "match",
    "market",
    "selection",
    "shop",
    "cashier",
    "customer",
    "channel",
    "hour",
    "day",
]


def get(client: TestClient, path: str, **params: str) -> Any:
    response = client.get(path, params=params, headers=REPORTS_ADMIN)
    assert response.status_code == 200, response.text
    return response.json()


class Mixed:
    """Two leagues, two matches, online and shop bets in every status."""

    def __init__(self, book: Book) -> None:
        self.book = book
        self.match_a = book.match(book.league("Premier Lagos"))
        self.match_b = book.match(
            book.league("Abuja Super"),
            status="IN_PLAY",
            home="Abuja FC",
            away="Jos Stars",
        )
        self.shop_1, self.shop_2 = book.shop("Ikeja"), book.shop("Surulere")
        self.till_1 = book.cashier(self.shop_1, "Till One")
        self.till_2 = book.cashier(self.shop_1, "Till Two")
        self.till_3 = book.cashier(self.shop_2, "Till Three")
        self.customers = [book.customer(name) for name in ("One", "Two", "Three")]
        one, two, three = self.customers

        book.bet(self.match_a, "HOME", 100_000, "WON", customer=one, minute=5)
        book.bet(self.match_a, "AWAY", 60_000, "LOST", customer=two, minute=6)
        book.bet(self.match_a, "DRAW", 30_000, "VOID", customer=three, minute=7)
        book.bet(self.match_b, "HOME", 45_000, "PENDING", customer=one, minute=8)
        book.bet(self.match_b, "AWAY", 15_000, "CANCELLED", customer=two, minute=9)
        book.bet(
            self.match_a,
            "HOME",
            40_000,
            "WON",
            cashier=self.till_1,
            paid_by=self.till_2,
            minute=10,
        )
        book.bet(self.match_a, "AWAY", 25_000, "LOST", cashier=self.till_2, minute=11)
        book.bet(
            self.match_b, "DRAW", 35_000, "PENDING", odds="3.40", cashier=self.till_3
        )
        book.bet(
            self.match_a,
            "HOME",
            20_000,
            "WON",
            cashier=self.till_3,
            paid_by=self.till_3,
            minute=12,
        )

    @property
    def cashiers(self) -> list[Cashier]:
        return [self.till_1, self.till_2, self.till_3]


class TestBreakdown:
    @pytest.mark.parametrize("dimension", DIMENSIONS)
    def test_every_dimension_sums_back_to_the_overview(
        self, client: TestClient, book: Book, dimension: str
    ) -> None:
        Mixed(book)
        totals = get(client, "/api/v1/admin/analytics/overview", **book.window)
        breakdown = get(
            client, "/api/v1/admin/analytics/breakdown", by=dimension, **book.window
        )
        rows = breakdown["items"]

        assert breakdown["by"] == dimension
        assert rows
        assert sum(row["bets"] for row in rows) == totals["totalBets"] == 9
        assert sum(row["pendingBets"] for row in rows) == totals["pendingBets"]
        assert sum(row["winningBets"] for row in rows) == totals["winningBets"]
        assert sum(row["losingBets"] for row in rows) == totals["losingBets"]
        assert sum(row["voidBets"] for row in rows) == totals["voidBets"]
        assert sum(row["stake"] for row in rows) == totals["totalStake"]
        assert sum(row["payout"] for row in rows) == totals["totalPayout"]
        assert sum(row["operatorResult"] for row in rows) == totals["operatorResult"]

    def test_pending_liability_is_potential_payout_minus_stake(
        self, client: TestClient, book: Book
    ) -> None:
        Mixed(book)
        rows = get(
            client, "/api/v1/admin/analytics/breakdown", by="match", **book.window
        )["items"]

        liability = (45_000 * 210 // 100 - 45_000) + (35_000 * 340 // 100 - 35_000)
        assert sum(row["pendingLiability"] for row in rows) == liability

    def test_online_bets_and_walk_in_tickets_keep_their_own_row(
        self, client: TestClient, book: Book
    ) -> None:
        mixed = Mixed(book)
        shops = get(
            client, "/api/v1/admin/analytics/breakdown", by="shop", **book.window
        )["items"]
        by_key = {row["key"]: row for row in shops}

        assert by_key["none"]["bets"] == 5
        assert by_key[mixed.shop_1.id]["label"] == "Ikeja"
        assert by_key[mixed.shop_1.id]["bets"] == 2
        assert by_key[mixed.shop_2.id]["bets"] == 2

    def test_filters_narrow_the_same_population(
        self, client: TestClient, book: Book
    ) -> None:
        mixed = Mixed(book)
        rows = get(
            client,
            "/api/v1/admin/analytics/breakdown",
            by="selection",
            matchId=mixed.match_a.id,
            **book.window,
        )["items"]

        assert {row["key"] for row in rows} == {
            "MATCH_RESULT:HOME",
            "MATCH_RESULT:AWAY",
            "MATCH_RESULT:DRAW",
        }
        assert sum(row["bets"] for row in rows) == 6


class TestSubjectViews:
    def test_customer_and_shop_views_add_up_to_the_global_totals(
        self, client: TestClient, book: Book
    ) -> None:
        mixed = Mixed(book)
        totals = get(client, "/api/v1/admin/analytics/overview", **book.window)

        views = [
            get(client, f"/api/v1/admin/analytics/accounts/{customer}", **book.window)
            for customer in mixed.customers
        ] + [
            get(client, f"/api/v1/admin/analytics/shops/{shop.id}", **book.window)
            for shop in (mixed.shop_1, mixed.shop_2)
        ]

        assert sum(view["bets"] for view in views) == totals["totalBets"]
        assert sum(view["stake"] for view in views) == totals["totalStake"]
        assert sum(view["payout"] for view in views) == totals["totalPayout"]
        assert sum(view["wins"] for view in views) == totals["winningBets"]
        assert sum(view["losses"] for view in views) == totals["losingBets"]
        assert sum(view["voids"] for view in views) == totals["voidBets"]
        assert sum(view["pendingBets"] for view in views) == totals["pendingBets"]
        assert (
            sum(view["operatorContribution"] for view in views)
            == totals["operatorResult"]
        )

    def test_a_customer_view_holds_only_that_customers_bets(
        self, client: TestClient, book: Book
    ) -> None:
        mixed = Mixed(book)
        view = get(
            client,
            f"/api/v1/admin/analytics/accounts/{mixed.customers[0]}",
            **book.window,
        )

        assert view["subjectKind"] == "CUSTOMER"
        assert view["subjectId"] == mixed.customers[0]
        assert view["label"] == "One"
        assert view["bets"] == 2
        assert view["pendingBets"] == 1
        assert view["stake"] == 145_000
        assert view["payout"] == 210_000
        assert view["netResult"] == 110_000
        assert view["operatorContribution"] == -110_000
        assert "commission" not in view

    def test_a_shop_view_carries_commission_and_float_transactions(
        self, client: TestClient, book: Book
    ) -> None:
        mixed = Mixed(book)
        account_id = new_id()
        book.insert(
            "wallet.wallet_accounts",
            {
                "id": account_id,
                "owner_type": "SHOP",
                "owner_id": mixed.shop_1.id,
                "balance": 0,
                "currency": "NGN",
            },
        )
        for index, amount in enumerate((-40_000, -25_000, 84_000)):
            book.insert(
                "wallet.wallet_transactions",
                {
                    "id": new_id(),
                    "account_id": account_id,
                    "type": "STAKE" if amount < 0 else "PAYOUT",
                    "amount": amount,
                    "currency": "NGN",
                    "balance_after": 0,
                    "idempotency_key": f"{account_id}:{index}",
                    "created_at": book.at(20 + index),
                },
            )
        book.insert(
            "settlement.commission_ledger",
            {
                "id": new_id(),
                "period_id": f"SESSION-{mixed.shop_1.code}",
                "shop_id": mixed.shop_1.id,
                "gross_stakes": 65_000,
                "gross_payouts": 84_000,
                "gross_operator_result": -19_000,
                "shop_share_percent": 20,
                "shop_share_amount": 1_234,
                "platform_share_percent": 80,
                "platform_share_amount": -20_234,
                "created_at": book.at(58),
            },
        )

        view = get(
            client, f"/api/v1/admin/analytics/shops/{mixed.shop_1.id}", **book.window
        )

        assert view["subjectKind"] == "SHOP"
        assert view["label"] == "Ikeja"
        assert view["bets"] == 2
        assert view["stake"] == 65_000
        assert view["payout"] == 84_000
        assert view["commission"] == 1_234
        assert view["transactions"] == 3

    def test_cashier_views_split_accepted_tickets_and_processed_payouts(
        self, client: TestClient, book: Book
    ) -> None:
        mixed = Mixed(book)
        shop_channel = get(
            client, "/api/v1/admin/analytics/breakdown", by="channel", **book.window
        )["items"]
        shop_totals = next(row for row in shop_channel if row["key"] == "SHOP")

        views = {
            cashier.id: get(
                client,
                f"/api/v1/admin/analytics/cashiers/{cashier.id}",
                **book.window,
            )
            for cashier in mixed.cashiers
        }

        assert sum(view["bets"] for view in views.values()) == shop_totals["bets"]
        assert sum(view["stake"] for view in views.values()) == shop_totals["stake"]
        assert (
            sum(view["operatorContribution"] for view in views.values())
            == shop_totals["operatorResult"]
        )
        # Till One sold the winning ticket; Till Two paid it.
        assert views[mixed.till_1.id]["bets"] == 1
        assert views[mixed.till_1.id]["payout"] == 0
        assert views[mixed.till_2.id]["payout"] == 84_000
        assert views[mixed.till_3.id]["payout"] == 42_000

    def test_an_unknown_subject_is_not_found(self, client: TestClient) -> None:
        for path in ("accounts", "shops", "cashiers", "matches"):
            response = client.get(
                f"/api/v1/admin/analytics/{path}/2b0e3a52-5d1c-4a67-9d2f-0f6f4f1f7a09",
                headers=REPORTS_ADMIN,
            )

            assert response.status_code == 404
            assert response.json()["error"]["code"] == "NOT_FOUND"
