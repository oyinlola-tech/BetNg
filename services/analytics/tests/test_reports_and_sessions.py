from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

from conftest import REPORTS_ADMIN, Book, cashier_headers


def get(client: TestClient, path: str, headers: dict[str, str], **params: str) -> Any:
    response = client.get(path, params=params, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


class TestShopDailyReport:
    def test_is_scoped_to_the_actors_shop_whatever_the_query_says(
        self, client: TestClient, book: Book
    ) -> None:
        match = book.match(book.league("Premier Lagos"))
        mine, other = book.shop("Mine"), book.shop("Other")
        till, second = book.cashier(mine, "Till One"), book.cashier(mine, "Till Two")
        rival = book.cashier(other, "Rival Till")

        book.bet(match, "HOME", 40_000, "WON", cashier=till, paid_by=second)
        book.bet(match, "AWAY", 25_000, "LOST", cashier=second)
        book.bet(match, "DRAW", 10_000, "PENDING", cashier=till)
        book.bet(match, "DRAW", 5_000, "CANCELLED", cashier=till)
        book.bet(match, "HOME", 900_000, "WON", cashier=rival, paid_by=rival)

        report = get(
            client,
            "/api/v1/shop/reports/daily",
            cashier_headers(till.id, mine.id, "reports:read"),
            date=book.day,
            shopId=other.id,
            shop_id=other.id,
        )

        assert report["shopId"] == mine.id
        assert report["date"] == book.day
        assert report["ticketsSold"] == 4
        assert report["sales"] == 75_000
        assert report["payouts"] == 84_000
        assert report["cancellations"] == 1
        assert report["openTickets"] == 1
        assert report["net"] == 75_000 - 84_000

        by_cashier = {row["cashierId"]: row for row in report["byCashier"]}
        assert by_cashier[till.id] == {
            "cashierId": till.id,
            "cashierName": "Till One",
            "ticketsSold": 3,
            "sales": 50_000,
            "payouts": 0,
        }
        assert by_cashier[second.id]["sales"] == 25_000
        assert by_cashier[second.id]["payouts"] == 84_000
        assert rival.id not in by_cashier
        assert report["byLeague"] == [
            {"leagueName": "Premier Lagos", "ticketsSold": 4, "sales": 75_000}
        ]

    def test_a_range_answers_one_report_per_day(
        self, client: TestClient, book: Book
    ) -> None:
        match = book.match(book.league())
        shop = book.shop()
        till = book.cashier(shop)
        book.bet(match, "HOME", 40_000, "LOST", cashier=till)
        next_day = book.at(24 * 60).date().isoformat()

        items = get(
            client,
            "/api/v1/shop/reports/daily/range",
            cashier_headers(till.id, shop.id, "reports:read"),
            **{"from": book.day, "to": next_day},
        )["items"]

        assert [item["date"] for item in items] == [book.day, next_day]
        assert [item["sales"] for item in items] == [40_000, 0]
        assert all(item["shopId"] == shop.id for item in items)


class TestPlatformReports:
    def test_a_day_is_the_aggregate_of_the_bets_placed_in_it(
        self, client: TestClient, book: Book
    ) -> None:
        match = book.match(book.league())
        till = book.cashier(book.shop())
        book.bet(match, "HOME", 100_000, "WON", customer=book.customer())
        book.bet(match, "AWAY", 60_000, "LOST", customer=book.customer())
        book.bet(match, "AWAY", 45_000, "PENDING", customer=book.customer())
        book.bet(match, "AWAY", 15_000, "CANCELLED", customer=book.customer())
        book.bet(match, "HOME", 40_000, "WON", cashier=till)

        items = get(
            client,
            "/api/v1/admin/reports/daily",
            REPORTS_ADMIN,
            **{"from": book.day, "to": book.day},
        )["items"]

        assert items == [
            {
                "date": book.day,
                "stake": 245_000,
                "payouts": 294_000,
                "net": 200_000 - 294_000,
                "bets": 5,
                "onlineStake": 205_000,
                "shopStake": 40_000,
            }
        ]

    def test_platform_overview_moves_with_the_rows(
        self, client: TestClient, book: Book
    ) -> None:
        admin = {**REPORTS_ADMIN, "x-betng-permissions": ""}
        before = get(client, "/api/v1/admin/overview", admin)

        league = book.league()
        book.match(league, status="IN_PLAY")
        match = book.match(league, status="BETTING_OPEN", result=None)
        pending = book.bet(match, "HOME", 45_000, "PENDING", customer=book.customer())

        after = get(client, "/api/v1/admin/overview", admin)

        assert after["openBets"] == before["openBets"] + 1
        assert after["liveMatches"] == before["liveMatches"] + 1
        # The bet sits in a past century, so today's money is untouched by it.
        assert after["todayStake"] == before["todayStake"]
        assert pending.payout is None


class TestSessions:
    def test_hour_day_and_custom_sessions_cover_the_same_bets(
        self, client: TestClient, book: Book
    ) -> None:
        match = book.match(book.league())
        till = book.cashier(book.shop())
        book.bet(match, "HOME", 100_000, "WON", customer=book.customer())
        book.bet(match, "AWAY", 60_000, "LOST", customer=book.customer())
        book.bet(match, "HOME", 40_000, "WON", cashier=till)
        day_code = book.day.replace("-", "")

        sessions = {
            kind: get(
                client,
                "/api/v1/admin/analytics/sessions",
                REPORTS_ADMIN,
                kind=kind,
                **book.window,
            )["items"]
            for kind in ("HOUR", "DAY", "CUSTOM")
        }

        for kind, items in sessions.items():
            assert len(items) == 1, kind
            session = items[0]
            assert session["kind"] == kind
            assert session["bets"] == 3
            assert session["stake"] == 200_000
            assert session["payout"] == 294_000
            assert session["operatorResult"] == -94_000
            assert session["customers"] == 2
            assert session["shops"] == 1
            assert session["cashiers"] == 1
            assert session["markets"] == 1
            assert session["matches"] == 1

        assert sessions["HOUR"][0]["sessionId"] == f"SESSION-{day_code}-0013"
        assert sessions["DAY"][0]["sessionId"] == f"SESSION-{day_code}"
        assert sessions["CUSTOM"][0]["sessionId"].startswith(f"SESSION-{day_code}T")
        assert sessions["HOUR"][0]["startsAt"].endswith("T12:00:00.000Z")
        assert sessions["HOUR"][0]["endsAt"].endswith("T13:00:00.000Z")

    def test_matchday_sessions_group_by_league_season_and_matchday(
        self, client: TestClient, book: Book
    ) -> None:
        league = book.league("Premier Lagos")
        seventh = book.match(league, season=1, matchday=7)
        eighth = book.match(league, season=1, matchday=8, home="Enugu", away="Warri")
        book.bet(seventh, "HOME", 100_000, "WON", customer=book.customer())
        book.bet(seventh, "AWAY", 60_000, "LOST", customer=book.customer())
        book.bet(eighth, "HOME", 30_000, "PENDING", customer=book.customer())

        for kind, unit in (("MATCHDAY", "MD"), ("ROUND", "R")):
            items = get(
                client,
                "/api/v1/admin/analytics/sessions",
                REPORTS_ADMIN,
                kind=kind,
                leagueId=league.id,
                **book.window,
            )["items"]
            by_id = {item["sessionId"]: item for item in items}

            assert set(by_id) == {
                f"SESSION-{league.code}-S1-{unit}07",
                f"SESSION-{league.code}-S1-{unit}08",
            }
            assert by_id[f"SESSION-{league.code}-S1-{unit}07"]["bets"] == 2
            assert by_id[f"SESSION-{league.code}-S1-{unit}07"]["stake"] == 160_000
            assert by_id[f"SESSION-{league.code}-S1-{unit}08"]["payout"] == 0


class TestExposure:
    def test_nests_pending_liability_by_match_market_and_selection(
        self, client: TestClient, book: Book
    ) -> None:
        match = book.match(book.league(), status="BETTING_OPEN", result=None)
        book.bet(match, "HOME", 45_000, "PENDING", customer=book.customer())
        book.bet(match, "HOME", 5_000, "PENDING", customer=book.customer())
        book.bet(
            match, "DRAW", 35_000, "PENDING", odds="3.40", customer=book.customer()
        )
        book.bet(match, "AWAY", 99_000, "LOST", customer=book.customer())

        response = client.get(
            "/internal/analytics/exposure", params={"matchId": match.id}
        )
        assert response.status_code == 200, response.text
        body = response.json()

        home = 45_000 * 210 // 100 - 45_000 + 5_000 * 210 // 100 - 5_000
        draw = 35_000 * 340 // 100 - 35_000

        assert body["totals"] == {
            "bets": 3,
            "stake": 85_000,
            "potentialPayout": 85_000 + home + draw,
            "liability": home + draw,
        }
        assert len(body["items"]) == 1
        exposure = body["items"][0]
        assert exposure["matchId"] == match.id
        assert exposure["liability"] == home + draw
        assert len(exposure["markets"]) == 1
        selections = {
            row["selectionCode"]: row for row in exposure["markets"][0]["selections"]
        }
        assert selections["HOME"]["liability"] == home
        assert selections["HOME"]["bets"] == 2
        assert selections["DRAW"]["liability"] == draw
        assert "AWAY" not in selections
