from __future__ import annotations

import os
from typing import Any

import psycopg
import pytest
from betng_service_kit import ServiceSettings
from fastapi.testclient import TestClient

from betng_analytics.app import create_app
from betng_analytics.configs import (
    SERVICE_NAME,
    SERVICE_VERSION,
    read_only_conninfo,
)
from conftest import (
    ANALYTICS_URL,
    INTERNAL_TOKEN,
    REPORTS_ADMIN,
    Book,
    admin_headers,
    cashier_headers,
    new_id,
)
from schema import TABLES

REPORT_ROUTES = [
    "/api/v1/admin/reports/daily",
    "/api/v1/admin/analytics/overview",
    "/api/v1/admin/analytics/breakdown?by=league",
    "/api/v1/admin/analytics/sessions?kind=DAY",
    f"/api/v1/admin/analytics/matches/{new_id()}",
    f"/api/v1/admin/analytics/accounts/{new_id()}",
    f"/api/v1/admin/analytics/shops/{new_id()}",
    f"/api/v1/admin/analytics/cashiers/{new_id()}",
]
SHOP_ROUTES = ["/api/v1/shop/reports/daily", "/api/v1/shop/reports/daily/range"]


def error_code(response: Any) -> str:
    code: str = response.json()["error"]["code"]
    return code


class TestPermissions:
    @pytest.mark.parametrize(
        "path", ["/api/v1/admin/overview", *REPORT_ROUTES, *SHOP_ROUTES]
    )
    def test_an_anonymous_call_is_unauthenticated(
        self, client: TestClient, path: str
    ) -> None:
        response = client.get(path)

        assert response.status_code == 401
        assert error_code(response) == "UNAUTHENTICATED"

    def test_the_actor_is_checked_before_the_query_is_validated(
        self, client: TestClient
    ) -> None:
        path = "/api/v1/admin/analytics/breakdown?by=nonsense&limit=-1"

        assert client.get(path).status_code == 401
        assert client.get(path, headers=admin_headers()).status_code == 403
        assert client.get(path, headers=REPORTS_ADMIN).status_code == 422

    @pytest.mark.parametrize("path", REPORT_ROUTES)
    def test_an_admin_without_reports_read_is_forbidden(
        self, client: TestClient, path: str
    ) -> None:
        response = client.get(path, headers=admin_headers("users:read", "risk:read"))

        assert response.status_code == 403
        assert error_code(response) == "FORBIDDEN"

    @pytest.mark.parametrize("path", ["/api/v1/admin/overview", *REPORT_ROUTES])
    def test_a_customer_or_cashier_cannot_read_admin_reports(
        self, client: TestClient, path: str
    ) -> None:
        customer = {**REPORTS_ADMIN, "x-betng-actor-kind": "CUSTOMER"}
        cashier = cashier_headers(new_id(), new_id(), "reports:read")

        for headers in (customer, cashier):
            response = client.get(path, headers=headers)

            assert response.status_code == 403
            assert error_code(response) == "FORBIDDEN"

    def test_any_admin_may_read_the_platform_overview(self, client: TestClient) -> None:
        response = client.get("/api/v1/admin/overview", headers=admin_headers())

        assert response.status_code == 200
        assert set(response.json()) == {
            "activeUsers",
            "activeShops",
            "openBets",
            "liveMatches",
            "todayStake",
            "todayPayouts",
            "todayNet",
            "generatedAt",
        }

    @pytest.mark.parametrize("path", SHOP_ROUTES)
    def test_shop_reports_need_a_cashier_with_reports_read_and_a_shop(
        self, client: TestClient, path: str
    ) -> None:
        shop_id = new_id()
        refused = [
            REPORTS_ADMIN,
            cashier_headers(new_id(), shop_id, "tickets:sell"),
            cashier_headers(new_id(), None, "reports:read"),
            cashier_headers(new_id(), "not-a-uuid", "reports:read"),
        ]

        for headers in refused:
            response = client.get(path, headers=headers)

            assert response.status_code == 403
            assert error_code(response) == "FORBIDDEN"

        allowed = client.get(
            path, headers=cashier_headers(new_id(), shop_id, "reports:read")
        )
        assert allowed.status_code == 200


OUTSIDER = {"x-betng-internal-token": "guessed-token-guessed-token-0001"}


class TestInternalToken:
    @pytest.mark.parametrize(
        "path",
        [
            "/internal/analytics/overview",
            "/internal/analytics/bets",
            "/internal/analytics/exposure",
            "/internal/analytics/operator",
            f"/internal/analytics/matches/{new_id()}",
        ],
    )
    def test_internal_routes_do_not_exist_for_an_outsider(
        self, client: TestClient, path: str
    ) -> None:
        response = client.get(path, headers=OUTSIDER)

        assert response.status_code == 404
        assert error_code(response) == "NOT_FOUND"

    def test_a_configured_token_is_required_and_sufficient(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        token = "rotated-internal-token-0123456789abcdef"
        monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", token)
        path = "/internal/analytics/overview"

        missing = client.get(path, headers={"x-betng-internal-token": ""})
        stale = client.get(path)
        presented = client.get(path, headers={"x-betng-internal-token": token})

        assert missing.status_code == 404
        assert stale.status_code == 404
        assert presented.status_code == 200

    def test_actor_headers_without_the_token_are_a_forgery(
        self, client: TestClient
    ) -> None:
        response = client.get(
            "/api/v1/admin/analytics/overview",
            headers={**REPORTS_ADMIN, **OUTSIDER},
        )

        assert response.status_code == 401
        assert error_code(response) == "UNAUTHENTICATED"


class TestReadOnly:
    @pytest.mark.parametrize("table", sorted(TABLES))
    def test_the_analytics_login_cannot_write_any_table(
        self, superuser: psycopg.Connection[Any], table: str
    ) -> None:
        with psycopg.connect(ANALYTICS_URL, autocommit=True) as connection:
            connection.execute(f"SELECT 1 FROM {table} LIMIT 1".encode())

            for statement in (
                f"INSERT INTO {table} DEFAULT VALUES",
                f"UPDATE {table} SET id = id"
                if table != "simulation.match_results"
                else f"UPDATE {table} SET match_id = match_id",
                f"DELETE FROM {table}",
                f"TRUNCATE {table}",
            ):
                with pytest.raises(psycopg.errors.InsufficientPrivilege):
                    connection.execute(statement.encode())

    @pytest.mark.parametrize(
        "schema",
        [
            "match",
            "odds",
            "simulation",
            "risk",
            "betting",
            "wallet",
            "settlement",
            "identity",
        ],
    )
    def test_the_analytics_login_cannot_create_anything(self, schema: str) -> None:
        with (
            psycopg.connect(ANALYTICS_URL, autocommit=True) as connection,
            pytest.raises(psycopg.errors.InsufficientPrivilege),
        ):
            connection.execute(
                f"CREATE TABLE {schema}.analytics_probe (id int)".encode()
            )

    def test_the_service_connection_is_read_only_as_well(self) -> None:
        with (
            psycopg.connect(
                read_only_conninfo(ANALYTICS_URL), autocommit=True
            ) as connection,
            pytest.raises(psycopg.errors.ReadOnlySqlTransaction),
        ):
            connection.execute("CREATE TEMP TABLE analytics_probe (id int)")


class TestResultSecrecy:
    def test_no_result_before_the_match_is_completed(
        self, client: TestClient, book: Book
    ) -> None:
        match = book.match(book.league(), status="IN_PLAY", result=(3, 0))
        book.bet(
            match,
            "HOME",
            10_000,
            "PENDING",
            customer=book.customer(),
            leg_result="3-0",
        )

        for path, headers in (
            (f"/api/v1/admin/analytics/matches/{match.id}", REPORTS_ADMIN),
            (f"/internal/analytics/matches/{match.id}", {}),
        ):
            response = client.get(path, headers=headers)

            assert response.status_code == 200, response.text
            body = response.json()
            assert body["status"] == "IN_PLAY"
            assert body["overview"]["totalBets"] == 1
            assert "result" not in body
            assert "homeGoals" not in response.text
            assert "winner" not in response.text

        bets = client.get("/internal/analytics/bets", params={"matchId": match.id})
        assert bets.status_code == 200, bets.text
        legs = bets.json()["items"][0]["legs"]
        assert "result" not in legs[0]
        assert "3-0" not in bets.text

    def test_the_result_is_answered_once_completed(
        self, client: TestClient, book: Book
    ) -> None:
        match = book.match(book.league(), status="COMPLETED", result=(2, 1))
        book.bet(
            match, "HOME", 10_000, "WON", customer=book.customer(), leg_result="2-1"
        )

        body = client.get(
            f"/api/v1/admin/analytics/matches/{match.id}", headers=REPORTS_ADMIN
        ).json()

        assert body["result"] == {
            "homeGoals": 2,
            "awayGoals": 1,
            "winner": "HOME",
            "winningGap": 1,
        }
        assert body["label"] == "Lagos United vs Kano Pillars"
        assert [row["bets"] for row in body["byMarket"]] == [1]
        assert body["byMarket"][0]["key"] == match.market_id
        assert body["bySelection"][0]["key"] == match.selections["HOME"]

        page = client.get(
            "/internal/analytics/bets", params={"matchId": match.id}
        ).json()
        assert page["total"] == 1
        assert page["page"] == 1
        assert page["items"][0]["legs"][0]["result"] == "2-1"
        assert page["items"][0]["payout"] == 21_000


class TestValidation:
    @pytest.mark.parametrize(
        "query",
        [
            "by=league;DROP TABLE betting.bets",
            "by=placed_at",
            "",
            "by=league&limit=501",
            "by=league&limit=0",
            "by=league&matchId=1 OR 1=1",
            "by=league&from=yesterday",
            "by=league&from=2026-01-02T00:00:00Z&to=2026-01-01T00:00:00Z",
            "by=league&unknown=1",
            "by=league&sort=stake",
        ],
    )
    def test_a_bad_breakdown_query_is_rejected(
        self, client: TestClient, query: str
    ) -> None:
        response = client.get(
            f"/api/v1/admin/analytics/breakdown?{query}", headers=REPORTS_ADMIN
        )

        assert response.status_code == 422
        assert error_code(response) == "VALIDATION_FAILED"

    @pytest.mark.parametrize(
        "path",
        [
            "/api/v1/admin/analytics/sessions?kind=WEEK",
            "/api/v1/admin/analytics/matches/not-a-uuid",
            "/api/v1/admin/analytics/accounts/1%27%20OR%20%271%27=%271",
            "/api/v1/admin/reports/daily?from=2026-13-45",
            "/api/v1/admin/reports/daily?from=1900-01-01&to=2026-01-01",
            "/internal/analytics/bets?pageSize=101",
            "/internal/analytics/bets?status=SETTLED",
            "/internal/analytics/exposure?limit=9999",
        ],
    )
    def test_other_bad_input_is_rejected(self, client: TestClient, path: str) -> None:
        response = client.get(path, headers=REPORTS_ADMIN)

        assert response.status_code == 422
        assert error_code(response) == "VALIDATION_FAILED"


class TestHealth:
    def test_ready_probes_the_database(self, client: TestClient) -> None:
        response = client.get("/ready")

        assert response.status_code == 200
        assert response.json()["dependencies"][0]["name"] == "postgres"
        assert response.json()["dependencies"][0]["status"] == "ok"

    def test_health_reports_the_service(self, client: TestClient) -> None:
        response = client.get("/health")

        assert response.status_code == 200
        assert response.json()["service"] == SERVICE_NAME

    def test_an_unreachable_database_is_reported_never_hidden(
        self, client: TestClient
    ) -> None:
        previous = os.environ["ANALYTICS_DATABASE_URL"]
        os.environ["ANALYTICS_DATABASE_URL"] = (
            "postgresql://betng_analytics:wrong@localhost:1/betng_test_analytics"
        )

        try:
            settings = ServiceSettings(
                service_name=SERVICE_NAME, version=SERVICE_VERSION, NODE_ENV="test"
            )

            with TestClient(create_app(settings)) as broken:
                broken.headers["x-betng-internal-token"] = INTERNAL_TOKEN
                ready = broken.get("/ready")
                overview = broken.get("/internal/analytics/overview")
        finally:
            os.environ["ANALYTICS_DATABASE_URL"] = previous

        assert ready.status_code == 503
        assert ready.json()["status"] == "unavailable"
        assert overview.status_code == 503
        assert error_code(overview) == "DATABASE_UNAVAILABLE"
        assert "localhost" not in overview.text
        assert "wrong" not in overview.text
