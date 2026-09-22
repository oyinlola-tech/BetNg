from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import psycopg
import pytest
from fastapi.testclient import TestClient

from betng_risk.engine import largest_stake
from betng_risk.engine.engine_type import Limits
from betng_risk.repositories import LimitsCache
from betng_risk.services.risk.exposure_alerts import (
    ExposureAlertMonitor,
    crossed_thresholds,
    run_alert_job,
)
from betng_risk.types import LimitsRecord
from conftest import (
    Book,
    FakeAudit,
    FakeSignals,
    admin_headers,
    evaluate_payload,
    force_limits,
    make_app,
    rpc,
)

MAX_KOBO = 10**15


def _record(version: int) -> LimitsRecord:
    from datetime import UTC, datetime

    return LimitsRecord(
        limits=Limits(version, 1, 2, 3, 4, 5, 6),
        created_at=datetime.now(UTC),
        created_by="test",
        reason="test",
    )


def _wait_listening(client: TestClient) -> LimitsCache:
    cache: LimitsCache = client.app.state.limits_cache  # type: ignore[attr-defined]
    deadline = time.monotonic() + 5
    while not cache._listening:
        assert time.monotonic() < deadline, "the limits listener never connected"
        time.sleep(0.02)
    return cache


def _max_stake(client: TestClient, payload: dict[str, Any]) -> int:
    body = rpc(client, "risk.evaluate", payload)
    assert body["success"] is True
    return int(body["result"]["maxStake"])


@pytest.fixture
def cached_client(
    audit: FakeAudit, signals: FakeSignals, superuser: psycopg.Connection[Any]
) -> Iterator[TestClient]:
    with TestClient(
        make_app(audit, signals, limits_cache_ms=60_000),
        raise_server_exceptions=False,
    ) as client:
        _wait_listening(client)
        yield client


class TestLimitsCacheUnit:
    def test_serves_within_ttl_only_while_listening(self) -> None:
        now = [0.0]
        cache = LimitsCache(5, clock=lambda: now[0])

        cache.store(_record(1), cache.generation())
        assert cache.get() is None

        cache.set_listening(True)
        cache.store(_record(1), cache.generation())
        assert cache.get() is not None
        now[0] = 5.0
        assert cache.get() is None

        cache.store(_record(1), cache.generation())
        cache.set_listening(False)
        assert cache.get() is None

    def test_a_read_that_raced_a_change_is_not_kept(self) -> None:
        cache = LimitsCache(5)
        cache.set_listening(True)

        generation = cache.generation()
        cache.invalidate()
        cache.store(_record(1), generation)

        assert cache.get() is None

    def test_a_zero_ttl_disables_it(self) -> None:
        cache = LimitsCache(0)
        cache.set_listening(True)
        cache.store(_record(1), cache.generation())

        assert not cache.enabled
        assert cache.get() is None


class TestLimitsCacheLive:
    def test_limits_are_served_from_the_cache_within_the_ttl(
        self,
        cached_client: TestClient,
        book: Book,
        superuser: psycopg.Connection[Any],
    ) -> None:
        payload = evaluate_payload(100_000, [(book.market(book.match()), "HOME")])
        assert _max_stake(cached_client, payload) == 50_000_000

        superuser.execute(
            "ALTER TABLE risk.risk_limits DISABLE TRIGGER risk_limits_changed"
        )
        try:
            force_limits(superuser, max_stake_per_bet=40_000_000)
            assert _max_stake(cached_client, payload) == 50_000_000
        finally:
            superuser.execute(
                "ALTER TABLE risk.risk_limits ENABLE TRIGGER risk_limits_changed"
            )

    def test_a_change_committed_anywhere_invalidates_every_replica(
        self,
        cached_client: TestClient,
        book: Book,
        superuser: psycopg.Connection[Any],
    ) -> None:
        payload = evaluate_payload(100_000, [(book.market(book.match()), "HOME")])
        assert _max_stake(cached_client, payload) == 50_000_000

        force_limits(superuser, max_stake_per_bet=30_000_000)

        deadline = time.monotonic() + 3
        while _max_stake(cached_client, payload) != 30_000_000:
            assert time.monotonic() < deadline, "stale limits outlived the change"
            time.sleep(0.02)

    def test_a_change_through_the_admin_api_applies_to_the_next_decision(
        self, cached_client: TestClient, book: Book
    ) -> None:
        payload = evaluate_payload(100_000, [(book.market(book.match()), "HOME")])
        assert _max_stake(cached_client, payload) == 50_000_000

        response = cached_client.put(
            "/api/v1/admin/risk/limits",
            json={"maxStakePerBet": 20_000_000, "reason": "Tighten for test"},
            headers=admin_headers("risk:write", "risk:read"),
        )
        assert response.status_code == 200, response.text

        assert _max_stake(cached_client, payload) == 20_000_000

    def test_exposure_is_never_cached(
        self,
        cached_client: TestClient,
        book: Book,
        superuser: psycopg.Connection[Any],
    ) -> None:
        superuser.execute(
            "ALTER TABLE risk.risk_limits DISABLE TRIGGER risk_limits_changed"
        )
        try:
            force_limits(superuser, max_liability_per_selection=1_000_000)
        finally:
            superuser.execute(
                "ALTER TABLE risk.risk_limits ENABLE TRIGGER risk_limits_changed"
            )
        superuser.execute("NOTIFY risk_limits_changed")
        match = book.match()
        market = book.market(match)
        payload = evaluate_payload(100_000, [(market, "HOME")])

        deadline = time.monotonic() + 3
        while _max_stake(cached_client, payload) != 1_000_000:
            assert time.monotonic() < deadline
            time.sleep(0.02)

        for _ in range(9):
            book.bet(100_000, [(match, market, "HOME")])
            before = _max_stake(cached_client, payload)
            book.bet(100_000, [(match, market, "HOME")])
            after = _max_stake(cached_client, payload)
            assert after == max(0, before - 100_000)

        body = rpc(cached_client, "risk.evaluate", payload)
        assert body["result"]["decision"] == "REJECT"
        assert body["result"]["reason"] == "EXPOSURE_LIMIT"

    def test_concurrent_decisions_each_read_the_live_book(
        self,
        cached_client: TestClient,
        book: Book,
        superuser: psycopg.Connection[Any],
    ) -> None:
        force_limits(superuser, max_liability_per_selection=500_000)
        match = book.match()
        market = book.market(match)
        payload = evaluate_payload(100_000, [(market, "HOME")])
        deadline = time.monotonic() + 3
        while _max_stake(cached_client, payload) != 500_000:
            assert time.monotonic() < deadline
            time.sleep(0.02)
        book.bet(400_000, [(match, market, "HOME")])

        with ThreadPoolExecutor(max_workers=5) as pool:
            results = list(
                pool.map(
                    lambda _: rpc(cached_client, "risk.evaluate", payload)["result"],
                    range(5),
                )
            )

        assert all(result["maxStake"] == 100_000 for result in results)


class TestSearchBound:
    @pytest.mark.parametrize(
        "boundary", [1, 2, 12_345, MAX_KOBO // 3, MAX_KOBO - 2, MAX_KOBO - 1]
    )
    def test_worst_case_iterations_are_logarithmic(self, boundary: int) -> None:
        calls = 0

        def allowed(stake: int) -> bool:
            nonlocal calls
            calls += 1
            return stake <= boundary

        assert largest_stake(allowed, MAX_KOBO) == boundary
        assert calls <= 2 + (MAX_KOBO - 1).bit_length()
        assert calls <= 52

    def test_the_bound_of_a_decision_is_the_largest_allowed_limit(self) -> None:
        from datetime import UTC, datetime, timedelta
        from decimal import Decimal

        from betng_risk.engine import ExposureBook, SelectionState, SlipLeg, decide

        now = datetime.now(UTC)
        leg = SlipLeg("m", "k", "s", Decimal("1.01"))
        limits = Limits(1, 1, MAX_KOBO, MAX_KOBO, MAX_KOBO, MAX_KOBO, MAX_KOBO)
        state = SelectionState(
            "s", "k", "m", "OPEN", "BETTING_OPEN", now + timedelta(minutes=5)
        )

        started = time.perf_counter()
        outcome = decide(
            stake=5,
            legs=[leg],
            limits=limits,
            states={"s": state},
            book=ExposureBook(),
            now=now,
        )

        assert outcome.decision == "ACCEPT"
        assert time.perf_counter() - started < 0.05


class TestExposureAlerts:
    def _limits(self, superuser: psycopg.Connection[Any], market: int) -> None:
        force_limits(
            superuser,
            max_liability_per_market=market,
            max_liability_per_match=1_000_000_000,
        )

    def test_alerts_once_per_threshold_crossing_and_rearms(
        self,
        client: TestClient,
        book: Book,
        signals: FakeSignals,
        superuser: psycopg.Connection[Any],
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        monitor: ExposureAlertMonitor = client.app.state.alert_monitor  # type: ignore[attr-defined]
        match = book.match()
        market = book.market(match)
        self._limits(superuser, 12_000)
        book.bet(10_000, [(match, market, "HOME")])

        with caplog.at_level(logging.WARNING):
            first = client.portal.call(monitor.check, [match.id])  # type: ignore[union-attr]
        assert [(c.scope, c.threshold) for c in first] == [("MARKET", 80)]
        assert signals.published == [("risk", "RISK_ALERT")]
        alert = next(
            r for r in caplog.records if r.getMessage() == "Risk exposure alert"
        )
        assert alert.__dict__["event"] == "risk_alert"
        assert alert.__dict__["scopeId"] == market.id
        assert alert.__dict__["threshold"] == 80
        assert alert.__dict__["utilisationPercent"] == 83

        assert client.portal.call(monitor.check, [match.id]) == []  # type: ignore[union-attr]
        assert len(signals.published) == 1

        book.bet(2_000, [(match, market, "HOME")])
        second = client.portal.call(monitor.check, [match.id])  # type: ignore[union-attr]
        assert [(c.scope, c.threshold) for c in second] == [("MARKET", 100)]
        assert len(signals.published) == 2

        self._limits(superuser, 100_000)
        assert client.portal.call(monitor.check, [match.id]) == []  # type: ignore[union-attr]
        rows = superuser.execute(
            "SELECT count(*) AS n FROM risk.exposure_alerts WHERE match_id = %s",
            (match.id,),
        ).fetchone()
        assert rows is not None and rows["n"] == 0

        self._limits(superuser, 12_000)
        again = client.portal.call(monitor.check, [match.id])  # type: ignore[union-attr]
        assert sorted(c.threshold for c in again) == [80, 100]
        assert len(signals.published) == 4

    def test_match_limits_alert_too(
        self,
        client: TestClient,
        book: Book,
        signals: FakeSignals,
        superuser: psycopg.Connection[Any],
    ) -> None:
        monitor: ExposureAlertMonitor = client.app.state.alert_monitor  # type: ignore[attr-defined]
        match = book.match()
        market = book.market(match)
        force_limits(
            superuser,
            max_liability_per_market=1_000_000_000,
            max_liability_per_match=10_000,
        )
        book.bet(10_000, [(match, market, "HOME")])

        crossed = client.portal.call(monitor.check, [match.id])  # type: ignore[union-attr]

        assert sorted((c.scope, c.threshold, c.scope_id) for c in crossed) == [
            ("MATCH", 80, match.id),
            ("MATCH", 100, match.id),
        ]

    def test_a_failed_signal_never_breaks_the_sweep(
        self,
        client: TestClient,
        book: Book,
        signals: FakeSignals,
        superuser: psycopg.Connection[Any],
    ) -> None:
        monitor: ExposureAlertMonitor = client.app.state.alert_monitor  # type: ignore[attr-defined]
        match = book.match()
        market = book.market(match)
        self._limits(superuser, 10_000)
        book.bet(10_000, [(match, market, "HOME")])
        signals.fail = True

        crossed = client.portal.call(monitor.check, [match.id])  # type: ignore[union-attr]

        assert len(crossed) == 2
        assert client.portal.call(monitor.check, [match.id]) == []  # type: ignore[union-attr]

    def test_threshold_arithmetic(self) -> None:
        assert crossed_thresholds("MARKET", "a", "m", 79, 100, 1) == []
        assert [
            c.threshold for c in crossed_thresholds("MARKET", "a", "m", 80, 100, 1)
        ] == [80]
        assert [
            c.threshold for c in crossed_thresholds("MARKET", "a", "m", 100, 100, 1)
        ] == [80, 100]
        assert crossed_thresholds("MARKET", "a", "m", -5, 100, 1) == []

    async def test_the_sweep_survives_a_failing_check(self) -> None:
        calls = 0

        class Flaky:
            async def check(self) -> list[Any]:
                nonlocal calls
                calls += 1
                raise RuntimeError("database down")

        task = asyncio.create_task(
            run_alert_job(Flaky(), 0.01, logging.getLogger("test"))  # type: ignore[arg-type]
        )
        await asyncio.sleep(0.05)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

        assert calls >= 2
