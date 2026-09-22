from __future__ import annotations

import csv
import io
import logging
from collections.abc import AsyncIterator
from datetime import UTC, date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from betng_service_kit import Pool, create_pool
from fastapi.testclient import TestClient
from psycopg.types.json import Jsonb

from betng_analytics.configs import read_only_conninfo
from betng_analytics.repositories import DailySummary, PostgresAnalyticsReader
from betng_analytics.services.analytics.queries.export_report import (
    export_report_handler,
)
from betng_analytics.services.analytics.queries.export_report.export_report_handler import (  # noqa: E501
    csv_cell,
)
from betng_analytics.types import DayRange, Row
from conftest import ANALYTICS_URL, REPORTS_ADMIN, Book, admin_headers, new_id

LOGGER = logging.getLogger("analytics-test")
EXPORT = "/api/v1/admin/reports/export"


@pytest.fixture
async def pool() -> AsyncIterator[Pool]:
    opened = create_pool(read_only_conninfo(ANALYTICS_URL), max_size=2)
    await opened.open()
    try:
        yield opened
    finally:
        await opened.close()


class CountingReader(PostgresAnalyticsReader):
    raw_calls: list[DayRange]

    async def _raw_daily_reports(self, days: DayRange) -> list[Row]:
        self.raw_calls.append(days)
        return await super()._raw_daily_reports(days)


def counting(pool: Pool, zone: str, summary: DailySummary | None) -> CountingReader:
    reader = CountingReader(pool, zone, LOGGER, summary)
    reader.raw_calls = []
    return reader


def seed_two_days(book: Book) -> tuple[date, date]:
    match = book.match(book.league())
    till = book.cashier(book.shop())
    book.bet(match, "HOME", 100_000, "WON", customer=book.customer())
    book.bet(match, "AWAY", 60_000, "LOST", customer=book.customer())
    book.bet(match, "DRAW", 15_000, "CANCELLED", customer=book.customer())
    book.bet(match, "HOME", 40_000, "WON", cashier=till, paid_by=till)
    book.bet(match, "AWAY", 25_000, "VOID", cashier=till)
    book.bet(match, "HOME", 70_000, "WON", customer=book.customer(), minute=24 * 60)
    pending = book.bet(
        match, "AWAY", 45_000, "PENDING", customer=book.customer(), minute=24 * 60 + 5
    )
    book.connection.execute(
        "UPDATE betting.bets SET potential_payout = %s WHERE id = %s",
        (94_500, pending.id),
    )
    first = book.start.date()
    return first, first + timedelta(days=1)


class TestDailySummary:
    @pytest.mark.parametrize("zone", ["UTC", "America/New_York", "Africa/Lagos"])
    async def test_the_summary_answers_exactly_what_the_raw_query_answers(
        self, pool: Pool, book: Book, zone: str
    ) -> None:
        settled_day, open_day = seed_two_days(book)
        days = DayRange(settled_day - timedelta(days=2), open_day + timedelta(days=2))

        raw = counting(pool, zone, None)
        summary = DailySummary(pool, zone, LOGGER)
        summarised = counting(pool, zone, summary)

        expected = await raw.daily_reports(days)
        sealed = await summary.refresh(days)

        pending_days = {
            row["day"] for row in expected if row["day"] not in summary.sealed(days)
        }
        assert sealed == len(expected) - len(pending_days)
        assert pending_days
        assert await summarised.daily_reports(days) == expected
        assert sum(row["bets"] for row in expected) == 7

    async def test_a_day_with_a_pending_bet_is_read_raw_until_it_settles(
        self, pool: Pool, book: Book
    ) -> None:
        settled_day, open_day = seed_two_days(book)
        days = DayRange(settled_day, open_day)
        summary = DailySummary(pool, "UTC", LOGGER)
        summarised = counting(pool, "UTC", summary)

        await summary.refresh(days)
        assert set(summary.sealed(days)) == {settled_day}

        before = await summarised.daily_reports(days)
        assert summarised.raw_calls == [DayRange(open_day, open_day)]

        book.connection.execute(
            "UPDATE betting.bets SET status = 'WON', payout = potential_payout "
            "WHERE placed_at >= %s AND status = 'PENDING'",
            (book.at(24 * 60),),
        )

        after = await summarised.daily_reports(days)
        assert after == await counting(pool, "UTC", None).daily_reports(days)
        assert after[1]["payout"] == before[1]["payout"] + 94_500
        assert after[0] == before[0]

        assert await summary.refresh(days) == 1
        summarised.raw_calls.clear()
        assert await summarised.daily_reports(days) == after
        assert summarised.raw_calls == []

    async def test_a_day_that_ended_within_the_grace_is_not_sealed(
        self, pool: Pool, book: Book
    ) -> None:
        settled_day, _ = seed_two_days(book)
        end = datetime.combine(settled_day + timedelta(days=1), time.min, UTC)
        days = DayRange(settled_day, settled_day)

        early = DailySummary(pool, "UTC", LOGGER, clock=lambda: end)
        assert await early.refresh(days) == 0
        assert early.sealed(days) == {}

        late = DailySummary(pool, "UTC", LOGGER, clock=lambda: end + timedelta(hours=2))
        assert await late.refresh(days) == 1

    async def test_a_sealed_day_is_not_read_again_and_old_days_are_pruned(
        self, pool: Pool, book: Book
    ) -> None:
        settled_day, _ = seed_two_days(book)
        days = DayRange(settled_day - timedelta(days=1), settled_day)
        summary = DailySummary(pool, "UTC", LOGGER)

        assert await summary.refresh(days) == 2
        assert await summary.refresh(days) == 0

        summary.prune(settled_day)
        assert set(summary.sealed(days)) == {settled_day}


def export(client: TestClient, headers: dict[str, str], **params: Any) -> Any:
    return client.get(EXPORT, headers=headers, params=params)


def rows_of(text: str) -> list[list[str]]:
    return list(csv.reader(io.StringIO(text)))


def audit_row(book: Book, minute: int, **fields: Any) -> str:
    audit_id = new_id()
    book.insert(
        "identity.audit_logs",
        {
            "id": audit_id,
            "actor_id": new_id(),
            "actor_role": "OPERATIONS",
            "actor_name": "Ops Admin",
            "action": "RISK_LIMITS_CHANGED",
            "entity_type": "risk_limits",
            "entity_id": "7",
            "before": Jsonb({"maxStakePerBet": 1}),
            "after": Jsonb({"maxStakePerBet": 2}),
            "reason": "Weekend",
            "severity": "WARNING",
            "request_id": new_id(),
            "created_at": book.at(minute),
            **fields,
        },
    )
    return audit_id


class TestExportAccess:
    def test_an_anonymous_or_unpermitted_caller_is_refused(
        self, client: TestClient
    ) -> None:
        params = {"format": "csv", "report": "daily"}

        assert client.get(EXPORT, params=params).status_code == 401
        assert export(client, admin_headers("users:read"), **params).status_code == 403
        customer = {**REPORTS_ADMIN, "x-betng-actor-kind": "CUSTOMER"}
        assert export(client, customer, **params).status_code == 403

    def test_the_audit_trail_needs_audit_read_as_well(
        self, client: TestClient, book: Book
    ) -> None:
        params = {"format": "csv", "report": "audit", "from": book.day, "to": book.day}

        refused = export(client, REPORTS_ADMIN, **params)
        assert refused.status_code == 403

        allowed = export(client, admin_headers("reports:read", "audit:read"), **params)
        assert allowed.status_code == 200, allowed.text

    @pytest.mark.parametrize(
        "params",
        [
            {"format": "xlsx", "report": "daily"},
            {"format": "pdf", "report": "daily"},
            {"report": "daily"},
            {"format": "csv", "report": "users"},
            {"format": "csv", "report": "daily", "shopId": new_id()},
            {
                "format": "csv",
                "report": "bets",
                "from": "2026-01-01",
                "to": "2027-06-01",
            },
        ],
    )
    def test_only_a_bounded_csv_of_a_known_report_is_answered(
        self, client: TestClient, params: dict[str, str]
    ) -> None:
        response = export(client, REPORTS_ADMIN, **params)

        assert response.status_code == 422
        assert response.json()["error"]["code"] == "VALIDATION_FAILED"


class TestExportContent:
    def test_the_daily_export_matches_the_daily_report(
        self, client: TestClient, book: Book
    ) -> None:
        seed_two_days(book)
        next_day = book.at(24 * 60).date().isoformat()
        window = {"from": book.day, "to": next_day}

        report = client.get(
            "/api/v1/admin/reports/daily", headers=REPORTS_ADMIN, params=window
        ).json()["items"]
        response = export(client, REPORTS_ADMIN, format="csv", report="daily", **window)

        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/csv")
        stamps = f"{book.day}-{next_day}".replace("-", "")
        name = f"betng-daily-{stamps[:8]}-{stamps[8:]}.csv"
        assert response.headers["content-disposition"] == (
            f'attachment; filename="{name}"'
        )
        assert response.headers["cache-control"] == "no-store"

        header, *lines = rows_of(response.text)
        assert header == [
            "date",
            "bets",
            "stakeKobo",
            "payoutsKobo",
            "netKobo",
            "onlineStakeKobo",
            "shopStakeKobo",
        ]
        assert lines == [
            [
                item["date"],
                str(item["bets"]),
                str(item["stake"]),
                str(item["payouts"]),
                str(item["net"]),
                str(item["onlineStake"]),
                str(item["shopStake"]),
            ]
            for item in report
        ]

    def test_the_bets_export_pages_through_every_bet_in_order(
        self, client: TestClient, book: Book, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(export_report_handler, "EXPORT_PAGE_SIZE", 2)
        match = book.match(book.league())
        placed = [
            book.bet(match, "HOME", 10_000 + minute, "LOST", minute=minute).id
            for minute in (9, 3, 7, 1, 5)
        ]

        response = export(
            client,
            REPORTS_ADMIN,
            format="csv",
            report="bets",
            **{"from": book.day, "to": book.day},
        )

        assert response.status_code == 200, response.text
        header, *lines = rows_of(response.text)
        assert header[:5] == ["id", "placedAt", "channel", "status", "stakeKobo"]
        by_minute = dict(zip((9, 3, 7, 1, 5), placed, strict=True))
        assert [line[0] for line in lines] == [by_minute[m] for m in (1, 3, 5, 7, 9)]
        assert [line[4] for line in lines] == [
            "10001",
            "10003",
            "10005",
            "10007",
            "10009",
        ]

        narrowed = export(
            client,
            REPORTS_ADMIN,
            format="csv",
            report="bets",
            status="WON",
            **{"from": book.day, "to": book.day},
        )
        assert rows_of(narrowed.text)[1:] == []

    def test_an_export_over_the_row_cap_is_refused(
        self, client: TestClient, book: Book, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(export_report_handler, "MAX_EXPORT_ROWS", 3)
        match = book.match(book.league())
        for minute in range(4):
            book.bet(match, "HOME", 10_000, "LOST", minute=minute)

        response = export(
            client,
            REPORTS_ADMIN,
            format="csv",
            report="bets",
            **{"from": book.day, "to": book.day},
        )

        assert response.status_code == 422

    def test_audit_cells_cannot_run_as_formulas(
        self, client: TestClient, book: Book
    ) -> None:
        first = audit_row(book, 2, actor_name='=HYPERLINK("http://x")')
        second = audit_row(book, 4, reason="+cmd|' /C calc'!A0", entity_id="@SUM(1)")

        response = export(
            client,
            admin_headers("reports:read", "audit:read"),
            format="csv",
            report="audit",
            **{"from": book.day, "to": book.day},
        )

        header, *lines = rows_of(response.text)
        cells = {line[0]: dict(zip(header, line, strict=True)) for line in lines}
        assert cells[first]["actorName"] == '\'=HYPERLINK("http://x")'
        assert cells[second]["reason"] == "'+cmd|' /C calc'!A0"
        assert cells[second]["resourceId"] == "'@SUM(1)"
        assert cells[first]["after"] == '{"maxStakePerBet": 2}'
        assert [line[0] for line in lines] == [first, second]


class TestCsvCell:
    @pytest.mark.parametrize(
        ("value", "expected"),
        [
            ("=1+1", "'=1+1"),
            ("-2", "'-2"),
            ("+2", "'+2"),
            ("@a", "'@a"),
            ("\tx", "'\tx"),
            ("\rx", "'\rx"),
            ("plain", "plain"),
            (-500, "-500"),
            (None, ""),
            (
                datetime(2026, 9, 21, 10, tzinfo=ZoneInfo("Africa/Lagos")),
                "2026-09-21T09:00:00.000Z",
            ),
            (date(2026, 9, 21), "2026-09-21"),
            (["=x"], '["=x"]'),
        ],
    )
    def test_a_cell_is_rendered_safely(self, value: Any, expected: str) -> None:
        assert csv_cell(value) == expected
