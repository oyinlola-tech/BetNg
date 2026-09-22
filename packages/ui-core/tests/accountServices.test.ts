import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BetNgApiError, type BetNgRestClient } from "@betng/client-sdk";
import type { CustomerSession } from "@betng/contracts";
import { createPlatformAccountServices } from "../src/adapters/platformAccountServices.js";
import { createPlatformAuthSource } from "../src/adapters/platformAccountSources.js";
import { readClientEnv } from "../src/runtime/clientEnv.js";
import { isAllowedExternalUrl, maskAccountNumber, safeReturnPath } from "../src/safety.js";
import { createSessionMonitor } from "../src/sessionMonitor.js";
import { COOKIE_SESSION_TOKEN, createSessionStore, withoutCredential } from "../src/session.js";

const customer = (expiresInMs = 3_600_000): CustomerSession =>
  ({ token: "t".repeat(24), expiresAt: new Date(Date.now() + expiresInMs).toISOString(), user: { id: "u", email: "a@b.co" } }) as unknown as CustomerSession;

const apiError = (status: number, code: string): BetNgApiError => new BetNgApiError(status, { code, message: "m", requestId: "req-1" });

function services(account: Partial<Record<keyof BetNgRestClient["account"], object>>) {
  const store = createSessionStore<CustomerSession>("c");

  store.set(customer());

  return { store, source: createPlatformAccountServices({ account } as unknown as BetNgRestClient, store, { uploadHosts: ["uploads.betng.ng"] }) };
}

describe("platform account services", () => {
  it("reports an unserved route as not implemented, keeping the request id", async () => {
    const { source } = services({ limits: { getSummary: async () => Promise.reject(apiError(404, "NOT_FOUND")) } });

    await expect(source.limits.getSummary()).rejects.toMatchObject({ code: "NOT_IMPLEMENTED", detail: { requestId: "req-1" } });
  });

  it("keeps a missing payment reference as not found", async () => {
    const { source } = services({ payments: { verifyDeposit: async () => Promise.reject(apiError(404, "NOT_FOUND")) } });

    await expect(source.payments.verifyDeposit("DEP1")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("ends the session when the platform rejects it", async () => {
    const { source, store } = services({ kyc: { getOverview: async () => Promise.reject(apiError(401, "UNAUTHENTICATED")) } });

    await expect(source.kyc.getOverview()).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
    expect(store.snapshot().status).toBe("EXPIRED");
  });

  it("maps responsible-gaming refusals", async () => {
    const { source } = services({ payments: { initiateDeposit: async () => Promise.reject(apiError(403, "SELF_EXCLUDED")) } });

    await expect(source.payments.initiateDeposit({ amount: 100, method: "CARD" }, "k")).rejects.toMatchObject({ code: "SELF_EXCLUDED" });
  });

  it("refuses a KYC file of the wrong type before asking for an upload slot", async () => {
    const createUpload = vi.fn();
    const { source } = services({ kyc: { createUpload } });
    const file = Object.assign(new Blob(["x"], { type: "text/html" }), { name: "id.html" });

    await expect(source.kyc.uploadDocument({ type: "PASSPORT", file })).rejects.toMatchObject({ code: "VALIDATION" });
    expect(createUpload).not.toHaveBeenCalled();
  });

  it("refuses to upload to a host the app does not trust", async () => {
    const submitDocument = vi.fn();
    const { source } = services({
      kyc: { createUpload: async () => ({ uploadId: "u", uploadUrl: "https://evil.example/put", method: "PUT", headers: {}, expiresAt: new Date(Date.now() + 60_000).toISOString() }), submitDocument },
    });
    const file = Object.assign(new Blob(["x"], { type: "image/png" }), { name: "id.png" });

    await expect(source.kyc.uploadDocument({ type: "PASSPORT", file })).rejects.toMatchObject({ code: "VALIDATION" });
    expect(submitDocument).not.toHaveBeenCalled();
  });

  it("moves the session expiry only when the platform refreshed it", async () => {
    const expiresAt = new Date(Date.now() + 7_200_000).toISOString();
    const { source, store } = services({ security: { refreshSession: async () => ({ expiresAt }) } });

    await source.security.refreshSession();

    expect(store.snapshot().session?.expiresAt).toBe(expiresAt);
  });
});

describe("platform auth source", () => {
  it("does not start a session when the platform asks for a second factor", async () => {
    const store = createSessionStore<CustomerSession>("c");
    const challenge = { challengeId: "c1", methods: ["TOTP"], expiresAt: new Date().toISOString() };
    const source = createPlatformAuthSource({ auth: { login: async () => ({ challenge }) } } as unknown as BetNgRestClient, store);

    await expect(source.login({ email: "a@b.co", password: "x" })).rejects.toMatchObject({ code: "TWO_FACTOR_REQUIRED", detail: { challenge } });
    expect(store.snapshot().status).toBe("ANONYMOUS");
  });
});

describe("safety helpers", () => {
  it("accepts only same-origin paths", () => {
    expect(safeReturnPath("/wallet?tab=1")).toBe("/wallet?tab=1");
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "javascript:alert(1)", "wallet", null, undefined]) expect(safeReturnPath(bad, "/")).toBe("/");
  });

  it("allows only https URLs on listed hosts", () => {
    expect(isAllowedExternalUrl("https://checkout.paystack.com/abc", ["checkout.paystack.com"])).toBe(true);
    expect(isAllowedExternalUrl("https://pay.flutterwave.com/x", [".flutterwave.com"])).toBe(true);
    expect(isAllowedExternalUrl("https://flutterwave.com.evil.io/x", [".flutterwave.com"])).toBe(false);
    expect(isAllowedExternalUrl("http://checkout.paystack.com/abc", ["checkout.paystack.com"])).toBe(false);
    expect(isAllowedExternalUrl("https://user:pw@checkout.paystack.com/", ["checkout.paystack.com"])).toBe(false);
  });

  it("masks account numbers to the last four digits", () => {
    expect(maskAccountNumber("0123456789")).toBe("••••••6789");
  });
});

describe("cookie session storage", () => {
  it("never persists the credential", () => {
    const data = new Map<string, string>();
    const store = createSessionStore<CustomerSession>("c", withoutCredential({ get: (k) => data.get(k), set: (k, v) => void data.set(k, v) }));

    store.set(customer());

    expect((JSON.parse(data.get("c") ?? "{}") as { token?: string }).token).toBe(COOKIE_SESSION_TOKEN);
  });
});

describe("client env", () => {
  it("reads per-flag variables and host allowlists", () => {
    const env = readClientEnv({ VITE_FEATURE_PAYMENTS: "true", VITE_FEATURE_FLAGS: "kycEnabled=true", VITE_CHECKOUT_HOSTS: "checkout.paystack.com, bad host, .flutterwave.com", VITE_AUTH_TRANSPORT: "cookie" });

    expect(env.flagOverrides).toMatchObject({ paymentsEnabled: true, kycEnabled: true });
    expect(env.checkoutHosts).toEqual(["checkout.paystack.com", ".flutterwave.com"]);
    expect(env.authTransport).toBe("cookie");
  });
});

describe("session monitor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("warns inside the final window and recovers after a refresh", async () => {
    const store = createSessionStore<CustomerSession>("c");

    store.set(customer(3 * 60_000));

    const refresh = vi.fn(async () => {
      store.set(customer(30 * 60_000));
    });
    const monitor = createSessionMonitor(store, { warnBeforeMs: 2 * 60_000, refresh });

    expect(monitor.state().phase).toBe("ACTIVE");
    vi.advanceTimersByTime(61_000);
    expect(monitor.state().phase).toBe("EXPIRING");

    await expect(monitor.refresh()).resolves.toBe(true);
    expect(monitor.state().phase).toBe("ACTIVE");
    monitor.dispose();
  });

  it("reports a refused refresh", async () => {
    const store = createSessionStore<CustomerSession>("c");

    store.set(customer(60_000));

    const monitor = createSessionMonitor(store, { refresh: async () => Promise.reject(new Error("no")) });

    await expect(monitor.refresh()).resolves.toBe(false);
    monitor.dispose();
  });
});
