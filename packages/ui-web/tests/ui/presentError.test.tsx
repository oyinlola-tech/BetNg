import { DataSourceError } from "@betng/ui-core";
import type { DataSourceErrorCode } from "@betng/ui-core";
import { describe, expect, it } from "vitest";
import { presentError } from "../../src/lib/errors";

const CODES: Record<DataSourceErrorCode, true> = {
  NOT_FOUND: true,
  NETWORK: true,
  OFFLINE: true,
  TIMEOUT: true,
  SERVER: true,
  UNAVAILABLE: true,
  NOT_IMPLEMENTED: true,
  BETTING_CLOSED: true,
  MARKET_SUSPENDED: true,
  ODDS_CHANGED: true,
  STAKE_LIMITED: true,
  BET_REJECTED: true,
  INSUFFICIENT_FUNDS: true,
  VALIDATION: true,
  INVALID_CREDENTIALS: true,
  UNAUTHENTICATED: true,
  SESSION_EXPIRED: true,
  FORBIDDEN: true,
  CONFLICT: true,
  RATE_LIMITED: true,
  TWO_FACTOR_REQUIRED: true,
  LIMIT_EXCEEDED: true,
  SELF_EXCLUDED: true,
  KYC_REQUIRED: true,
  PAYMENT_FAILED: true,
};

const ALL = Object.keys(CODES) as DataSourceErrorCode[];
const GENERIC_TITLE = "Something went wrong";

describe("presentError", () => {
  it.each(ALL)("presents %s with its own wording", (code) => {
    const presented = presentError(new DataSourceError(code, ""));

    expect(presented.code).toBe(code);
    expect(presented.title.length).toBeGreaterThan(0);
    expect(presented.message.length).toBeGreaterThan(0);
    expect(["danger", "warning", "info"]).toContain(presented.tone);
    expect(typeof presented.retryable).toBe("boolean");

    if (code !== "SERVER") expect(presented.title).not.toBe(GENERIC_TITLE);
  });

  it.each(["SERVER", "UNAVAILABLE"] as const)("never surfaces raw server text for %s", (code) => {
    const raw = "ECONNREFUSED 10.0.4.12:5432 at pg.connect (pool.js:41)";
    const presented = presentError(new DataSourceError(code, raw));

    expect(presented.message).not.toContain("ECONNREFUSED");
    expect(presented.message).not.toContain("pool.js");
    expect(presented.retryable).toBe(true);
  });

  it("uses the platform's sentence for domain refusals", () => {
    const presented = presentError(
      new DataSourceError("STAKE_LIMITED", "The maximum stake for this bet is NGN 5,000."),
    );

    expect(presented.message).toBe("The maximum stake for this bet is NGN 5,000.");
    expect(presented.retryable).toBe(false);
  });

  it("falls back when a platform message is unreasonably long", () => {
    const presented = presentError(new DataSourceError("VALIDATION", "x".repeat(2000)));

    expect(presented.message).toBe("Some details are missing or not valid.");
  });

  it("mentions the wait for RATE_LIMITED", () => {
    expect(
      presentError(new DataSourceError("RATE_LIMITED", "", { retryAfterSeconds: 30 })).message,
    ).toBe("Too many requests. Wait 30 seconds before trying again.");
    expect(
      presentError(new DataSourceError("RATE_LIMITED", "", { retryAfterSeconds: 90 })).message,
    ).toBe("Too many requests. Wait about 2 minutes before trying again.");
    expect(presentError(new DataSourceError("RATE_LIMITED", "")).message).toBe(
      "Wait a moment before trying again.",
    );
  });

  it("carries the request id for support", () => {
    const presented = presentError(new DataSourceError("SERVER", "", { requestId: "req_8f2a" }));

    expect(presented.requestId).toBe("req_8f2a");
  });

  it("marks only retry-worthy codes retryable", () => {
    const retryable = ALL.filter((code) => presentError(new DataSourceError(code, "")).retryable);

    expect(retryable.sort()).toEqual(
      [
        "MARKET_SUSPENDED",
        "NETWORK",
        "ODDS_CHANGED",
        "OFFLINE",
        "RATE_LIMITED",
        "SERVER",
        "TIMEOUT",
        "UNAVAILABLE",
      ].sort(),
    );
  });

  it("gives unknown errors generic wording without a stack trace", () => {
    const error = new TypeError("Cannot read properties of undefined (reading 'odds')");
    const presented = presentError(error);

    expect(presented.title).toBe(GENERIC_TITLE);
    expect(presented.message).not.toContain("Cannot read");
    expect(presented.message).not.toContain(error.stack ?? "stack");
    expect(presentError("boom").title).toBe(GENERIC_TITLE);
    expect(presentError(undefined).title).toBe(GENERIC_TITLE);
  });
});
