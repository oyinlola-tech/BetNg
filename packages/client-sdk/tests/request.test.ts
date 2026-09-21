import { afterEach, describe, expect, it, vi } from "vitest";
import { BetNgApiError } from "../src/rest/restError.js";
import { buildQuery, createRequester } from "../src/rest/request.js";

const config = { gatewayUrl: "http://gateway.test", liveUrl: "ws://live.test" };

function respond(status: number, body?: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createRequester", () => {
  it("sends the bearer token read at request time", async () => {
    respond(200, { ok: true });

    const session: { token?: string } = {};
    const request = createRequester({ ...config, getToken: () => session.token });

    await request("GET", "/a");
    session.token = "abc";
    await request("GET", "/b");

    const calls = vi.mocked(fetch).mock.calls.map(([, init]) => (init?.headers as Record<string, string>)["authorization"]);

    expect(calls).toEqual([undefined, "Bearer abc"]);
  });

  it("answers undefined for 204 instead of failing to parse", async () => {
    respond(204);

    await expect(createRequester(config)("POST", "/logout")).resolves.toBeUndefined();
  });

  it("reports an expired token once, and only when a token was sent", async () => {
    respond(401, { error: { code: "UNAUTHENTICATED", message: "expired", requestId: "r" } });

    const onUnauthorized = vi.fn();

    await expect(createRequester({ ...config, onUnauthorized })("GET", "/x")).rejects.toBeInstanceOf(BetNgApiError);
    expect(onUnauthorized).not.toHaveBeenCalled();

    await expect(createRequester({ ...config, getToken: () => "t", onUnauthorized })("GET", "/x")).rejects.toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("names 403 FORBIDDEN even when the body is not an error envelope", async () => {
    respond(403, { nope: true });

    await expect(createRequester(config)("GET", "/x")).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("turns a network failure into status 0", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );

    await expect(createRequester(config)("GET", "/x")).rejects.toMatchObject({ status: 0, code: "UPSTREAM_UNAVAILABLE" });
  });
});

describe("buildQuery", () => {
  it("drops undefined and empty values and stringifies numbers", () => {
    expect(buildQuery({ a: "1", b: undefined, c: "", page: 2 })).toBe("?a=1&page=2");
    expect(buildQuery({})).toBe("");
  });
});
