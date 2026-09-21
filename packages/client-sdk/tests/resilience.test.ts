import { afterEach, describe, expect, it, vi } from "vitest";
import { codeForStatus, type BetNgApiError } from "../src/rest/restError.js";
import { createRequester } from "../src/rest/request.js";

const config = { gatewayUrl: "http://gateway.test", liveUrl: "ws://live.test" };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function failure(run: Promise<unknown>): Promise<BetNgApiError> {
  try {
    await run;
  } catch (error) {
    return error as BetNgApiError;
  }

  throw new Error("expected a failure");
}

describe("status mapping without an envelope", () => {
  it.each([
    [400, "VALIDATION_FAILED"],
    [401, "UNAUTHENTICATED"],
    [403, "FORBIDDEN"],
    [404, "NOT_FOUND"],
    [409, "CONFLICT"],
    [422, "VALIDATION_FAILED"],
    [429, "RATE_LIMITED"],
    [500, "INTERNAL_ERROR"],
    [502, "UPSTREAM_UNAVAILABLE"],
    [503, "SERVICE_UNAVAILABLE"],
    [504, "UPSTREAM_UNAVAILABLE"],
  ])("%i becomes %s", (status, code) => {
    expect(codeForStatus(status)).toBe(code);
  });

  it("does not leak a proxy's HTML error page", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>nginx 502 at 10.0.0.4</html>", { status: 502 })));

    const error = await failure(createRequester({ ...config, retries: 0 })("GET", "/a"));

    expect(error.status).toBe(502);
    expect(error.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(error.message).not.toContain("nginx");
  });

  it("reads retry-after on a 429", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 429, headers: { "retry-after": "12" } })));

    expect((await failure(createRequester(config)("POST", "/a", {}))).retryAfterSeconds).toBe(12);
  });
});

describe("retries and idempotency", () => {
  it("retries a read through transient failures, then succeeds", async () => {
    vi.useFakeTimers();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    vi.stubGlobal("fetch", fetchMock);

    const failures: number[] = [];
    const run = createRequester({ ...config, onRequestError: (f) => failures.push(f.attempt) })<{ ok: boolean }>("GET", "/a");

    await vi.runAllTimersAsync();

    expect(await run).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(failures).toEqual([1, 2]);
  });

  it("never retries a write", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 503 }));

    vi.stubGlobal("fetch", fetchMock);
    await failure(createRequester(config)("POST", "/bets", {}));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry a refusal", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 404 }));

    vi.stubGlobal("fetch", fetchMock);
    await failure(createRequester(config)("GET", "/a"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends the idempotency key the gateway forwards", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));

    vi.stubGlobal("fetch", fetchMock);
    await createRequester(config)("POST", "/bets", {}, { idempotencyKey: "ref-12345678" });

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;

    expect(headers["idempotency-key"]).toBe("ref-12345678");
  });

  it("reports offline without calling the network", async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", { onLine: false });

    const error = await failure(createRequester(config)("GET", "/a"));

    expect(error.kind).toBe("offline");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("names a timeout as one", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: URL, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
            });
          }),
      ),
    );

    const run = failure(createRequester({ ...config, timeoutMs: 50, retries: 0 })("GET", "/a"));

    await vi.advanceTimersByTimeAsync(60);

    expect((await run).kind).toBe("timeout");
  });
});
