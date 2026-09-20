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
});
