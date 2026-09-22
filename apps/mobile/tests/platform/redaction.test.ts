import { describe, expect, it } from "vitest";
import { createCrashReporter, type CrashReport } from "../../src/platform/crashReporting";
import { redact, redactString } from "../../src/platform/redaction";

describe("redact", () => {
  it("removes credentials, codes and PINs by key at any depth", () => {
    const out = redact({
      token: "abc",
      accessToken: "abc",
      password: "hunter22",
      currentPassword: "x",
      pin: "1234",
      otp: "123456",
      code: "654321",
      backupCodes: ["a", "b"],
      headers: { Authorization: "Bearer xyz", Cookie: "sid=1" },
      nested: { deeper: { refresh_token: "r", bvn: "22222222222", accountNumber: "0123456789" } },
      matchId: "M1",
    });

    expect(out).toEqual({
      token: "[redacted]",
      accessToken: "[redacted]",
      password: "[redacted]",
      currentPassword: "[redacted]",
      pin: "[redacted]",
      otp: "[redacted]",
      code: "[redacted]",
      backupCodes: "[redacted]",
      headers: { Authorization: "[redacted]", Cookie: "[redacted]" },
      nested: { deeper: { refresh_token: "[redacted]", bvn: "[redacted]", accountNumber: "[redacted]" } },
      matchId: "M1",
    });
  });

  it("keeps enum-style error codes", () => {
    expect(redact({ code: "SESSION_EXPIRED" })).toEqual({ code: "SESSION_EXPIRED" });
  });

  it("scrubs secrets embedded in strings", () => {
    const text = redactString(
      "GET /x?token=abc&page=2 Authorization: Bearer eyJhbGciOi.eyJzdWIiOi.sig otp=998877 mail a@b.co ExponentPushToken[xyz] pin: 4321",
    );

    expect(text).not.toMatch(/abc&|eyJ|998877|a@b\.co|xyz|4321/);
    expect(text).toContain("page=2");
    expect(text).toContain("Bearer [redacted]");
  });

  it("serialises errors without leaking their messages' secrets", () => {
    const error = Object.assign(new Error("failed with Bearer secret-token-value"), { code: "NETWORK" });
    const out = redact(error) as Record<string, unknown>;

    expect(out["message"]).toBe("failed with Bearer [redacted]");
    expect(out["code"]).toBe("NETWORK");
  });

  it("survives cycles and depth", () => {
    const loop: Record<string, unknown> = { a: 1 };

    loop["self"] = loop;
    expect(redact(loop)).toEqual({ a: 1, self: "[circular]" });
  });
});

describe("createCrashReporter", () => {
  it("is a silent no-op without a sink", () => {
    expect(() => {
      createCrashReporter().captureException(new Error("x"));
    }).not.toThrow();
  });

  it("hands the sink only redacted reports", () => {
    const reports: CrashReport[] = [];
    const reporter = createCrashReporter((r) => reports.push(r), () => 0);

    reporter.setUser("U_1");
    reporter.captureException(new Error("token=abc123"), { password: "p", pin: "0000", screen: "Wallet" });
    reporter.captureMessage("Bearer zzz", "warning");

    expect(reports[0]?.message).toBe("token=[redacted]");
    expect(reports[0]?.context).toEqual({ password: "[redacted]", pin: "[redacted]", screen: "Wallet" });
    expect(reports[0]?.userId).toBe("U_1");
    expect(reports[1]?.message).toBe("Bearer [redacted]");
    expect(JSON.stringify(reports)).not.toMatch(/abc123|zzz|"p"|0000/);
  });

  it("ignores a failing sink", () => {
    const reporter = createCrashReporter(() => {
      throw new Error("sink down");
    });

    expect(() => {
      reporter.captureMessage("x");
    }).not.toThrow();
  });
});
