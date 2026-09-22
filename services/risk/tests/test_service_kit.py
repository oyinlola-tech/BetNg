from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Iterator
from typing import Any

import httpx
import pytest
from betng_service_kit import (
    CALLER_HEADER,
    INTERNAL_TOKEN_HEADER,
    METRICS_CONTENT_TYPE,
    RPC_CIRCUIT_OPEN,
    RPC_RATE_LIMITED,
    BreakerSettings,
    BreakerState,
    CallerRateLimiter,
    CircuitBreaker,
    CircuitOpenError,
    PeerClient,
    RpcClient,
    RpcError,
    RpcProcedure,
    RpcServer,
    ServiceError,
    ServiceSettings,
    create_service_app,
    current_trace_id,
    internal_headers,
    limiter_from_env,
    parse_traceparent,
)
from betng_service_kit.logging import JsonFormatter
from fastapi import APIRouter
from fastapi.testclient import TestClient

TOKEN = "kit-test-internal-token-0123456789"
TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736"
INBOUND = f"00-{TRACE_ID}-00f067aa0ba902b7-01"


class Clock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


@pytest.fixture
def token(monkeypatch: pytest.MonkeyPatch) -> str:
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", TOKEN)
    return TOKEN


def _app(
    monkeypatch: pytest.MonkeyPatch, *, rate: str = "", burst: str = ""
) -> TestClient:
    monkeypatch.setenv("RPC_RATE_LIMIT_PER_SECOND", rate)
    monkeypatch.setenv("RPC_RATE_LIMIT_BURST", burst)

    router = APIRouter()
    seen: dict[str, Any] = {}

    @router.get("/items/{item_id}")
    async def item(item_id: str) -> dict[str, Any]:
        seen["trace"] = current_trace_id()
        return {"id": item_id}

    server = RpcServer()

    async def echo(payload: Any) -> Any:
        return payload

    server.register(RpcProcedure(name="kit.echo", handler=echo))
    app = create_service_app(
        ServiceSettings(service_name="risk", NODE_ENV="test"),
        description="kit test",
        routers=[router],
        rpc_server=server,
    )
    app.state.seen = seen
    return TestClient(app, raise_server_exceptions=False)


def _frame() -> dict[str, Any]:
    return {"id": "f1", "procedure": "kit.echo", "payload": {"a": 1}}


class TestMetrics:
    def test_metrics_are_hidden_without_the_internal_token(
        self, token: str, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        client = _app(monkeypatch)

        response = client.get("/metrics")

        assert response.status_code == 404
        assert response.json()["error"]["code"] == "NOT_FOUND"
        wrong = client.get("/metrics", headers={INTERNAL_TOKEN_HEADER: "x" * 34})
        assert wrong.status_code == 404

    def test_metrics_use_the_typescript_kit_names_and_route_templates(
        self, token: str, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        client = _app(monkeypatch)
        client.get("/items/a1")
        client.get("/items/b2")
        client.get("/nowhere")

        response = client.get("/metrics", headers={INTERNAL_TOKEN_HEADER: token})

        assert response.status_code == 200
        assert response.headers["content-type"] == METRICS_CONTENT_TYPE
        body = response.text
        labels = 'service="risk",method="GET",route="/items/{item_id}",status="200"'
        assert f"http_requests_total{{{labels}}} 2" in body
        assert f'http_request_duration_seconds_bucket{{{labels},le="+Inf"}} 2' in body
        assert f'http_request_duration_seconds_bucket{{{labels},le="0.005"}}' in body
        assert f"http_request_duration_seconds_count{{{labels}}} 2" in body
        assert 'route="unmatched",status="404"' in body
        assert "a1" not in body
        for name in (
            "# TYPE http_requests_total counter",
            "# TYPE http_request_duration_seconds histogram",
            'process_cpu_seconds_total{service="risk"}',
            'process_resident_memory_bytes{service="risk"}',
            'process_start_time_seconds{service="risk"}',
        ):
            assert name in body


class TestRpcRateLimit:
    def test_a_caller_over_its_budget_gets_429_with_retry_after(
        self, token: str, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        client = _app(monkeypatch, rate="1", burst="2")
        betting = {INTERNAL_TOKEN_HEADER: token, CALLER_HEADER: "betting"}

        assert client.post("/rpc", json=_frame(), headers=betting).status_code == 200
        assert client.post("/rpc", json=_frame(), headers=betting).status_code == 200
        limited = client.post("/rpc", json=_frame(), headers=betting)

        assert limited.status_code == 429
        assert int(limited.headers["retry-after"]) >= 1
        assert limited.json()["error"]["code"] == RPC_RATE_LIMITED

        odds = {INTERNAL_TOKEN_HEADER: token, CALLER_HEADER: "odds"}
        assert client.post("/rpc", json=_frame(), headers=odds).status_code == 200

    def test_outsiders_are_not_counted_and_still_see_404(
        self, token: str, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        client = _app(monkeypatch, rate="1", burst="1")
        forged = {INTERNAL_TOKEN_HEADER: "y" * 34, CALLER_HEADER: "betting"}

        for _ in range(5):
            assert client.post("/rpc", json=_frame(), headers=forged).status_code == 404

        betting = {INTERNAL_TOKEN_HEADER: token, CALLER_HEADER: "betting"}
        assert client.post("/rpc", json=_frame(), headers=betting).status_code == 200

    def test_the_limiter_refills_and_bounds_tracked_callers(self) -> None:
        clock = Clock()
        limiter = CallerRateLimiter(10, 1, clock=clock)

        assert limiter.acquire("betting") == 0
        wait = limiter.acquire("betting")
        assert wait == pytest.approx(0.1)
        clock.now += 0.1
        assert limiter.acquire("betting") == 0

        for index in range(200):
            limiter.acquire(f"svc-{index}")
        assert len(limiter._buckets) <= 65

    def test_defaults_are_generous_and_zero_disables(self) -> None:
        limiter = limiter_from_env({})
        assert limiter is not None
        assert limiter._rate == 1000
        assert limiter_from_env({"RPC_RATE_LIMIT_PER_SECOND": "0"}) is None
        with pytest.raises(ValueError):
            limiter_from_env({"RPC_RATE_LIMIT_PER_SECOND": "-1"})

    def test_internal_clients_name_themselves(
        self, token: str, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        _app(monkeypatch)

        headers = internal_headers()

        assert headers[CALLER_HEADER] == "risk"
        assert headers[INTERNAL_TOKEN_HEADER] == token


class TestCircuitBreaker:
    def test_closed_open_half_open_closed(self) -> None:
        clock = Clock()
        breaker = CircuitBreaker(
            "identity",
            BreakerSettings(failure_threshold=3, reset_timeout_ms=5000),
            clock=clock,
        )

        for _ in range(3):
            breaker.before_call()
            breaker.record_failure()
        assert breaker.state is BreakerState.OPEN
        with pytest.raises(CircuitOpenError):
            breaker.before_call()

        clock.now += 5
        assert breaker.state is BreakerState.HALF_OPEN
        breaker.before_call()
        with pytest.raises(CircuitOpenError):
            breaker.before_call()
        breaker.record_success()
        assert breaker.state is BreakerState.CLOSED

    def test_a_failed_probe_reopens(self) -> None:
        clock = Clock()
        breaker = CircuitBreaker(
            "identity",
            BreakerSettings(failure_threshold=1, reset_timeout_ms=1000),
            clock=clock,
        )
        breaker.record_failure()
        clock.now += 1
        breaker.before_call()
        breaker.record_failure()

        assert breaker.state is BreakerState.OPEN

    def test_a_success_resets_the_consecutive_count(self) -> None:
        breaker = CircuitBreaker("identity", BreakerSettings(failure_threshold=2))
        breaker.record_failure()
        breaker.record_success()
        breaker.record_failure()

        assert breaker.state is BreakerState.CLOSED

    def test_settings_are_validated(self) -> None:
        with pytest.raises(ValueError):
            BreakerSettings(failure_threshold=0)
        with pytest.raises(ValueError):
            BreakerSettings.from_env({"RPC_BREAKER_RESET_MS": "soon"})
        assert (
            BreakerSettings.from_env(
                {"RPC_BREAKER_FAILURE_THRESHOLD": "9"}
            ).failure_threshold
            == 9
        )

    async def test_the_rpc_client_stops_calling_a_failing_peer(self) -> None:
        calls = 0

        def handler(request: httpx.Request) -> httpx.Response:
            nonlocal calls
            calls += 1
            raise httpx.ConnectError("down", request=request)

        client = RpcClient(
            "http://identity.test",
            "identity",
            1000,
            breaker=CircuitBreaker("identity", BreakerSettings(failure_threshold=2)),
            transport=httpx.MockTransport(handler),
        )

        for _ in range(2):
            with pytest.raises(RpcError):
                await client.call("identity.recordAudit", {})
        with pytest.raises(RpcError) as raised:
            await client.call("identity.recordAudit", {})

        assert raised.value.code == RPC_CIRCUIT_OPEN
        assert calls == 2

    async def test_domain_refusals_and_rate_limits_do_not_trip_it(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            frame = json.loads(request.content)
            if frame["procedure"] == "limited":
                return httpx.Response(429, headers={"retry-after": "2"})
            return httpx.Response(
                200,
                json={
                    "id": frame["id"],
                    "success": False,
                    "error": {"code": "FORBIDDEN", "message": "no"},
                },
            )

        breaker = CircuitBreaker("identity", BreakerSettings(failure_threshold=1))
        client = RpcClient(
            "http://identity.test",
            "identity",
            1000,
            breaker=breaker,
            transport=httpx.MockTransport(handler),
        )

        with pytest.raises(RpcError) as refused:
            await client.call("refused", {})
        with pytest.raises(RpcError) as limited:
            await client.call("limited", {})

        assert refused.value.code == "FORBIDDEN"
        assert limited.value.code == RPC_RATE_LIMITED
        assert breaker.state is BreakerState.CLOSED


class TestInFlightDeduplication:
    async def test_identical_gets_share_one_request(self) -> None:
        calls: list[httpx.Request] = []
        release = asyncio.Event()

        async def handler(request: httpx.Request) -> httpx.Response:
            calls.append(request)
            await release.wait()
            return httpx.Response(200, json={"path": request.url.path})

        client = PeerClient(
            "http://match.test",
            "match",
            1000,
            breaker=CircuitBreaker("match"),
            transport=httpx.MockTransport(handler),
        )

        tasks = [
            asyncio.create_task(client.get("/fixtures", params={"a": 1, "b": 2}))
            for _ in range(5)
        ]
        other = asyncio.create_task(
            client.get("/fixtures", params={"a": 1, "b": 2}, headers={"x-a": "2"})
        )
        await asyncio.sleep(0.01)
        assert client.inflight() == 2
        release.set()
        results = await asyncio.gather(*tasks, other)

        assert len(calls) == 2
        assert all(result.data == {"path": "/fixtures"} for result in results)
        assert client.inflight() == 0

        await client.get("/fixtures", params={"a": 1, "b": 2})
        assert len(calls) == 3

    async def test_a_failure_reaches_every_waiter_and_is_not_cached(self) -> None:
        attempts = 0

        async def handler(request: httpx.Request) -> httpx.Response:
            nonlocal attempts
            attempts += 1
            await asyncio.sleep(0.01)
            if attempts == 1:
                raise httpx.ConnectError("down", request=request)
            return httpx.Response(200, json={})

        client = PeerClient(
            "http://match.test",
            "match",
            1000,
            breaker=CircuitBreaker("match"),
            transport=httpx.MockTransport(handler),
        )

        results = await asyncio.gather(
            client.get("/x"), client.get("/x"), return_exceptions=True
        )
        assert all(isinstance(result, ServiceError) for result in results)
        assert (await client.get("/x")).status == 200

    async def test_one_waiter_cancelling_does_not_cancel_the_others(self) -> None:
        release = asyncio.Event()

        async def handler(request: httpx.Request) -> httpx.Response:
            await release.wait()
            return httpx.Response(200, json={"ok": True})

        client = PeerClient(
            "http://match.test",
            "match",
            1000,
            breaker=CircuitBreaker("match"),
            transport=httpx.MockTransport(handler),
        )
        first = asyncio.create_task(client.get("/x"))
        second = asyncio.create_task(client.get("/x"))
        await asyncio.sleep(0.01)
        first.cancel()
        release.set()

        assert (await second).data == {"ok": True}

    async def test_paths_must_stay_on_the_peer(self) -> None:
        client = PeerClient("http://match.test", "match", 1000)
        for path in ("//evil.test/x", "http://evil.test/x"):
            with pytest.raises(ValueError):
                await client.get(path)


class TestTracing:
    def test_traceparent_parsing(self) -> None:
        parsed = parse_traceparent(INBOUND)
        assert parsed is not None
        assert parsed.trace_id == TRACE_ID
        for invalid in (
            None,
            "",
            "01-" + INBOUND[3:],
            f"00-{'0' * 32}-00f067aa0ba902b7-01",
            f"00-{TRACE_ID}-{'0' * 16}-01",
            f"00-{TRACE_ID.upper()}-00f067aa0ba902b7-01",
            INBOUND + "\r\nx: y",
        ):
            assert parse_traceparent(invalid) is None

    def test_an_inbound_trace_is_adopted_and_forwarded(
        self, token: str, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        client = _app(monkeypatch)

        client.get("/items/a", headers={"traceparent": INBOUND})
        assert client.app.state.seen["trace"] == TRACE_ID  # type: ignore[attr-defined]

        client.get("/items/a", headers={"traceparent": "garbage"})
        fresh = client.app.state.seen["trace"]  # type: ignore[attr-defined]
        assert fresh != TRACE_ID and len(fresh) == 32

    async def test_outbound_calls_carry_a_child_of_the_current_trace(self) -> None:
        from betng_service_kit.tracing import bind_trace

        seen: list[str] = []

        def handler(request: httpx.Request) -> httpx.Response:
            seen.append(request.headers["traceparent"])
            frame = json.loads(request.content)
            return httpx.Response(
                200, json={"id": frame["id"], "success": True, "result": 1}
            )

        bind_trace(parse_traceparent(INBOUND))
        try:
            await RpcClient(
                "http://event.test",
                "event",
                1000,
                breaker=CircuitBreaker("event"),
                transport=httpx.MockTransport(handler),
            ).call("event.publishSignal", {})
        finally:
            bind_trace(None)

        child = parse_traceparent(seen[0])
        assert child is not None
        assert child.trace_id == TRACE_ID
        assert child.span_id != "00f067aa0ba902b7"

    def test_log_lines_carry_the_trace_id(self) -> None:
        from betng_service_kit.tracing import bind_trace

        formatter = JsonFormatter("risk", "0.1.0", "test")
        record = logging.LogRecord("risk", logging.INFO, "", 0, "hello", None, None)

        bind_trace(parse_traceparent(INBOUND))
        try:
            line = json.loads(formatter.format(record))
        finally:
            bind_trace(None)

        assert line["metadata"]["traceId"] == TRACE_ID


@pytest.fixture(autouse=True)
def _reset_identity() -> Iterator[None]:
    yield
    from betng_service_kit import set_service_identity

    set_service_identity("risk")
