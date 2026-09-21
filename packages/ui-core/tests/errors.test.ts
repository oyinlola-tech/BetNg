import { describe, expect, it } from "vitest";
import { BetNgApiError } from "@betng/client-sdk";
import { translateApiError } from "../src/adapters/errors.js";
import { DataSourceError } from "../src/dataSource.type.js";

const api = (status: number, code: string): BetNgApiError => new BetNgApiError(status, { code, message: "m", requestId: "r" });

describe("translateApiError", () => {
  it.each([
    [api(0, "UPSTREAM_UNAVAILABLE"), "NETWORK"],
    [api(403, "FORBIDDEN"), "FORBIDDEN"],
    [api(404, "NOT_FOUND"), "NOT_FOUND"],
    [api(409, "CONFLICT"), "CONFLICT"],
    [api(429, "RATE_LIMITED"), "RATE_LIMITED"],
    [api(400, "VALIDATION_FAILED"), "VALIDATION"],
    [api(500, "INTERNAL_ERROR"), "SERVER"],
    [api(422, "VALIDATION_FAILED"), "VALIDATION"],
    [api(502, "UPSTREAM_UNAVAILABLE"), "UNAVAILABLE"],
    [api(503, "SERVICE_UNAVAILABLE"), "UNAVAILABLE"],
    [api(504, "INTERNAL_ERROR"), "TIMEOUT"],
    [api(501, "NOT_IMPLEMENTED"), "NOT_IMPLEMENTED"],
    [api(409, "MARKET_CLOSED"), "BETTING_CLOSED"],
    [api(409, "ODDS_CHANGED"), "ODDS_CHANGED"],
    [api(422, "STAKE_LIMITED"), "STAKE_LIMITED"],
    [api(422, "RISK_REJECTED"), "BET_REJECTED"],
    [api(402, "INSUFFICIENT_FUNDS"), "INSUFFICIENT_FUNDS"],
    [new BetNgApiError(0, { code: "UPSTREAM_UNAVAILABLE", message: "m", requestId: "r" }, { kind: "offline" }), "OFFLINE"],
    [new BetNgApiError(0, { code: "SERVICE_UNAVAILABLE", message: "m", requestId: "r" }, { kind: "timeout" }), "TIMEOUT"],
  ])("maps %o to %s", (cause, code) => {
    expect(translateApiError(cause).code).toBe(code);
  });

  it("reads a 401 as bad credentials when nobody was signed in", () => {
    expect(translateApiError(api(401, "UNAUTHENTICATED"), false).code).toBe("INVALID_CREDENTIALS");
  });

  it("reads a 401 as an ended session when somebody was", () => {
    expect(translateApiError(api(401, "UNAUTHENTICATED"), true).code).toBe("SESSION_EXPIRED");
  });

  it("passes a DataSourceError through untouched", () => {
    const error = new DataSourceError("FORBIDDEN", "no");

    expect(translateApiError(error)).toBe(error);
  });

  it("treats anything unknown as a server failure", () => {
    expect(translateApiError("boom").code).toBe("SERVER");
  });

  it("never shows a server's own words for a 5xx", () => {
    const cause = new BetNgApiError(500, { code: "INTERNAL_ERROR", message: "TypeError: x is undefined at /srv/app.js:10", requestId: "req-1" });
    const error = translateApiError(cause);

    expect(error.message).not.toContain("TypeError");
    expect(error.detail.requestId).toBe("req-1");
  });

  it("carries field errors and the retry delay", () => {
    const cause = new BetNgApiError(
      429,
      { code: "RATE_LIMITED", message: "slow down", requestId: "r", details: [{ path: "stake", message: "Too small" }, { path: "stake", message: "second" }] },
      { retryAfterSeconds: 30 },
    );
    const error = translateApiError(cause);

    expect(error.detail.fields).toEqual({ stake: "Too small" });
    expect(error.detail.retryAfterSeconds).toBe(30);
  });
});
