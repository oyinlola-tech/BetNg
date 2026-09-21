import { describe, expect, it } from "vitest";
import { DEFAULT_FLAGS, parseFlagOverrides, resolveFlags } from "../src/flags.js";
import { createLogger, redact, type LogEntry } from "../src/logger.js";

describe("feature flags", () => {
  it("reads build-time overrides and ignores unknown names", () => {
    expect(parseFlagOverrides("walletEnabled=false, tvEnabled=true,nonsense=true,liveEnabled=maybe")).toEqual({
      walletEnabled: false,
      tvEnabled: true,
    });
    expect(parseFlagOverrides(undefined)).toEqual({});
  });

  it("lets the platform win over the build, and the build over defaults", () => {
    const flags = resolveFlags({ walletEnabled: true }, { walletEnabled: false, shopEnabled: false });

    expect(flags.walletEnabled).toBe(true);
    expect(flags.shopEnabled).toBe(false);
    expect(flags.liveEnabled).toBe(DEFAULT_FLAGS.liveEnabled);
  });
});

describe("logger", () => {
  it("redacts credentials and financial detail at any depth", () => {
    expect(
      redact({ user: { password: "x", email: "a@b.c" }, headers: { Authorization: "Bearer t" }, stake: 5, path: "/bets" }),
    ).toEqual({
      user: { password: "[redacted]", email: "[redacted]" },
      headers: { Authorization: "[redacted]" },
      stake: "[redacted]",
      path: "/bets",
    });
  });

  it("reduces an error to its name and message", () => {
    expect(redact({ cause: new TypeError("boom") })).toEqual({ cause: { name: "TypeError", message: "boom" } });
  });

  it("filters by level, survives a failing sink and detaches sinks", () => {
    const entries: LogEntry[] = [];
    const logger = createLogger({
      minLevel: "warn",
      sinks: [
        () => {
          throw new Error("sink down");
        },
      ],
    });
    const detach = logger.addSink((entry) => entries.push(entry));

    logger.info("api", "ignored");
    logger.error("api", "request failed", { token: "secret", status: 503 });
    detach();
    logger.error("api", "after detach");

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ level: "error", category: "api", context: { token: "[redacted]", status: 503 } });
  });
});
