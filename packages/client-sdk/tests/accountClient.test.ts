import { afterEach, describe, expect, it, vi } from "vitest";
import { createAccountClient } from "../src/rest/accountClient.js";
import { createAuthClient } from "../src/rest/authClient.js";
import { createComplianceClient } from "../src/rest/complianceClient.js";
import { createRequester } from "../src/rest/request.js";
import { BetNgApiError } from "../src/rest/restError.js";

const config = { gatewayUrl: "http://gateway.test", liveUrl: "ws://live.test" };
const at = "2026-09-21T10:00:00.000Z";

const payment = {
  reference: "DEP000123",
  direction: "DEPOSIT",
  status: "PENDING",
  amount: 50_000,
  currency: "NGN",
  method: "CARD",
  createdAt: at,
  updatedAt: at,
};

function respond(status: number, body?: unknown): ReturnType<typeof vi.fn> {
  const fetch = vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status }));

  vi.stubGlobal("fetch", fetch);

  return fetch;
}

const sent = (fetch: ReturnType<typeof vi.fn>, call = 0): { url: string; init: RequestInit & { headers: Record<string, string> } } => {
  const [url, init] = fetch.mock.calls[call] as [URL, RequestInit & { headers: Record<string, string> }];

  return { url: url.toString(), init };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("account client", () => {
  it("sends the caller's idempotency key on a deposit and validates the answer", async () => {
    const fetch = respond(200, { payment, expiresAt: at });
    const client = createAccountClient(createRequester(config));

    const result = await client.payments.initiateDeposit({ amount: 50_000, method: "CARD" }, { idempotencyKey: "key-1" });

    expect(result.payment.reference).toBe("DEP000123");
    expect(sent(fetch).url).toBe("http://gateway.test/api/v1/payments/deposit/initiate");
    expect(sent(fetch).init.headers["idempotency-key"]).toBe("key-1");
  });

  it("rejects a payment whose amount is a float instead of minor units", async () => {
    respond(200, { ...payment, amount: 500.5 });

    await expect(createAccountClient(createRequester(config)).payments.verifyDeposit("DEP000123")).rejects.toMatchObject({ kind: "parse", code: "INVALID_RESPONSE" });
  });

  it("rejects an unknown payment status rather than rendering it", async () => {
    respond(200, { ...payment, status: "SUCCESSFUL_PROBABLY" });

    await expect(createAccountClient(createRequester(config)).payments.verifyDeposit("DEP000123")).rejects.toBeInstanceOf(BetNgApiError);
  });

  it("rejects a bank account whose number is not masked", async () => {
    respond(200, { items: [{ id: "1", bankCode: "058", bankName: "GTBank", accountNumberMasked: "0123456789x", accountName: "A", isDefault: true, verified: true, createdAt: at }] });

    await expect(createAccountClient(createRequester(config)).payments.listBankAccounts()).rejects.toMatchObject({ kind: "parse" });
  });

  it("rejects a page without paging fields", async () => {
    respond(200, { items: [payment] });

    await expect(createAccountClient(createRequester(config)).payments.listHistory()).rejects.toMatchObject({ kind: "parse" });
  });

  it("escapes identifiers in paths", async () => {
    const fetch = respond(200, payment);

    await createAccountClient(createRequester(config)).payments.getWithdrawal("../../admin");

    expect(sent(fetch).url).toBe("http://gateway.test/api/v1/payments/withdraw/status/..%2F..%2Fadmin");
  });

  it("never sends a client-supplied account name when saving a bank account", async () => {
    const fetch = respond(200, { id: "1", bankCode: "058", bankName: "GTBank", accountNumberMasked: "******6789", accountName: "ADA OBI", isDefault: true, verified: true, createdAt: at });

    await createAccountClient(createRequester(config)).payments.saveBankAccount({ verificationId: "v1", makeDefault: true });

    expect(JSON.parse(sent(fetch).init.body as string)).toEqual({ verificationId: "v1", makeDefault: true });
  });

  it("rejects a KYC upload target that is not a URL", async () => {
    respond(200, { uploadId: "u", uploadUrl: "javascript:alert(1)", method: "PUT", headers: {}, expiresAt: at });

    await expect(createAccountClient(createRequester(config)).kyc.createUpload({ type: "PASSPORT", fileName: "p.jpg", contentType: "image/jpeg", sizeBytes: 10 })).rejects.toMatchObject({ kind: "parse" });
  });
});

describe("auth client", () => {
  it("turns a 2FA answer into a challenge instead of a session", async () => {
    respond(200, { twoFactor: { challengeId: "c1", methods: ["TOTP"], expiresAt: at } });

    await expect(createAuthClient(createRequester(config)).login({ email: "a@b.co", password: "x" })).resolves.toEqual({ challenge: { challengeId: "c1", methods: ["TOTP"], expiresAt: at } });
  });
});

describe("compliance client", () => {
  it("validates operator pages", async () => {
    respond(200, { items: [], page: 1, pageSize: 20, total: 0 });

    await expect(createComplianceClient(createRequester(config)).listKycQueue({ status: "PENDING" })).resolves.toEqual({ items: [], page: 1, pageSize: 20, total: 0 });
  });
});

describe("cookie sessions", () => {
  it("includes credentials and echoes the CSRF cookie on state-changing requests only", async () => {
    vi.stubGlobal("document", { cookie: "other=1; betng_csrf=abc%3D123" });
    const fetch = respond(200, {});
    const request = createRequester({ ...config, credentials: "include", csrf: { cookie: "betng_csrf", header: "x-csrf-token" } });

    await request("GET", "/a");
    await request("POST", "/b", {});

    expect(sent(fetch, 0).init.credentials).toBe("include");
    expect(sent(fetch, 0).init.headers["x-csrf-token"]).toBeUndefined();
    expect(sent(fetch, 1).init.headers["x-csrf-token"]).toBe("abc=123");
    expect(sent(fetch, 1).init.headers["authorization"]).toBeUndefined();
  });

  it("reports a 401 as an ended session in cookie mode even without a bearer token", async () => {
    respond(401, { error: { code: "UNAUTHENTICATED", message: "no", requestId: "r" } });
    const onUnauthorized = vi.fn();

    await expect(createRequester({ ...config, credentials: "include", onUnauthorized })("GET", "/x")).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("never retries a financial command", async () => {
    const fetch = respond(503, { error: { code: "SERVICE_UNAVAILABLE", message: "down", requestId: "r" } });

    await expect(createAccountClient(createRequester(config)).payments.requestWithdrawal({ amount: 1_000, bankAccountId: "b" }, { idempotencyKey: "k" })).rejects.toMatchObject({ status: 503 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
