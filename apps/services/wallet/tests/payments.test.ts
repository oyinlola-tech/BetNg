import { randomUUID } from "node:crypto";
import {
  adminPaymentSchema,
  bankAccountSchema,
  bankAccountVerificationSchema,
  depositInitiationSchema,
  pageSchema,
  paymentOverviewSchema,
  paymentRecordSchema,
  statementJobSchema,
  walletSchema,
  withdrawalQuoteSchema,
} from "@betng/contracts";
import { createRpcClient, createServiceLogger } from "@betng/service-kit";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createIdentityPeer, IdentityUnavailableError } from "../src/clients/identity.client.js";
import { loadWalletConfig } from "../src/configs/index.js";
import { api, createFixtures, errorCode, openRepository } from "./support.js";
import type { DirectRepository, Fixtures } from "./support.js";
import { ENCRYPTION_KEY, PAYSTACK_KEY, startFakePaystack, startPaymentsApp, webhook } from "./payments.support.js";
import type { FakePaystack, PaymentsApp } from "./payments.support.js";

let fixtures: Fixtures;
let direct: DirectRepository;
let paystack: FakePaystack;
let running: PaymentsApp;

const REVIEW_THRESHOLD = 20_000_000;

beforeAll(async () => {
  fixtures = await createFixtures();
  direct = await openRepository();
  paystack = await startFakePaystack();
  running = await startPaymentsApp({
    PAYMENTS_PROVIDER: "paystack",
    PAYSTACK_SECRET_KEY: PAYSTACK_KEY,
    PAYSTACK_BASE_URL: paystack.url,
    PAYMENTS_CALLBACK_BASE_URL: "https://betng.example",
    WALLET_ENCRYPTION_KEY: ENCRYPTION_KEY,
    WITHDRAWAL_REVIEW_THRESHOLD_KOBO: String(REVIEW_THRESHOLD),
  });
});

afterAll(async () => {
  await running.stop();
  await paystack.close();
  await direct.close();
  await fixtures.close();
});

beforeEach(() => {
  const { identity } = running;

  identity.limit = { allowed: true };
  identity.kyc = { status: "VERIFIED", tier: "TIER_2", dailyDeposit: undefined, dailyWithdrawal: undefined };
  identity.unreachable = false;
  identity.auditFails = false;
  paystack.down = false;
  paystack.verifyDelayMs = 0;
});

function as(id: string) {
  return { kind: "CUSTOMER" as const, id };
}

function key(): string {
  return `key-${randomUUID()}`;
}

async function initiate(customerId: string, amount: number, idempotencyKey = key(), extra: Record<string, unknown> = {}) {
  return api("POST", "/api/v1/payments/deposit/initiate", {
    actor: as(customerId),
    headers: { "idempotency-key": idempotencyKey },
    body: { amount, method: "CARD", ...extra },
  });
}

async function depositEntries(customerId: string) {
  const account = await direct.prisma.walletAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: "CUSTOMER", ownerId: customerId } },
  });

  return account === null
    ? []
    : direct.prisma.walletTransaction.findMany({ where: { accountId: account.id, type: "DEPOSIT" } });
}

async function balance(customerId: string): Promise<number> {
  const response = await api("GET", "/api/v1/wallets/me", { actor: as(customerId) });

  return (response.body as { balance: number }).balance;
}

function reference(response: { body: unknown }): string {
  return (response.body as { payment: { reference: string } }).payment.reference;
}

function chargeEvent(ref: string, amount: number, id = Math.floor(Math.random() * 1e9)) {
  return { event: "charge.success", data: { id, reference: ref, amount, currency: "NGN", status: "success" } };
}

describe("deposits", () => {
  it("refuses an initiation without an idempotency key", async () => {
    const customerId = await fixtures.customer();
    const response = await api("POST", "/api/v1/payments/deposit/initiate", {
      actor: as(customerId),
      body: { amount: 500_000, method: "CARD" },
    });

    expect(response.status).toBe(422);
    expect(errorCode(response)).toBe("VALIDATION_FAILED");
  });

  it("initiates with an https checkout, builds the callback on the configured origin, and replays a repeated key", async () => {
    const customerId = await fixtures.customer();
    const idempotencyKey = key();
    const first = await initiate(customerId, 500_000, idempotencyKey, { returnPath: "/wallet?tab=deposit" });

    expect(first.status).toBe(201);
    expect(depositInitiationSchema.safeParse(first.body).success).toBe(true);

    const body = first.body as { checkoutUrl: string; payment: { status: string; provider: string } };

    expect(body.checkoutUrl.startsWith("https://")).toBe(true);
    expect(body.payment.status).toBe("PENDING");
    expect(body.payment.provider).toBe("PAYSTACK");

    const init = paystack.calls.filter((call) => call.path === "/transaction/initialize" && (call.body as { reference: string }).reference === reference(first));

    expect(init).toHaveLength(1);
    expect((init[0]?.body as { callback_url: string }).callback_url).toBe("https://betng.example/wallet?tab=deposit");
    expect((init[0]?.body as { amount: number }).amount).toBe(500_000);

    const replay = await initiate(customerId, 500_000, idempotencyKey, { returnPath: "/wallet?tab=deposit" });

    expect(replay.status).toBe(201);
    expect(reference(replay)).toBe(reference(first));
    expect(paystack.calls.filter((call) => call.path === "/transaction/initialize" && (call.body as { reference: string }).reference === reference(first))).toHaveLength(1);

    const conflicting = await initiate(customerId, 600_000, idempotencyKey);

    expect(conflicting.status).toBe(409);
  });

  it("refuses a return path that leaves the site", async () => {
    const customerId = await fixtures.customer();
    const response = await initiate(customerId, 500_000, key(), { returnPath: "//evil.example/steal" });

    expect(response.status).toBe(422);
  });

  it("credits exactly once, only after the provider confirms, whatever the client says", async () => {
    const customerId = await fixtures.customer();
    const created = await initiate(customerId, 750_000);
    const ref = reference(created);
    const before = await balance(customerId);

    const pending = await api("POST", "/api/v1/payments/deposit/verify", { actor: as(customerId), body: { reference: ref } });

    expect(pending.status).toBe(200);
    expect((pending.body as { status: string }).status).toBe("PENDING");
    expect(await depositEntries(customerId)).toHaveLength(0);

    paystack.charges.set(ref, { status: "success", amount: 750_000, currency: "NGN" });

    const confirmed = await api("POST", "/api/v1/payments/deposit/verify", { actor: as(customerId), body: { reference: ref } });

    expect(paymentRecordSchema.safeParse(confirmed.body).success).toBe(true);
    expect((confirmed.body as { status: string }).status).toBe("CONFIRMED");
    expect(await balance(customerId)).toBe(before + 750_000);

    await api("POST", "/api/v1/payments/deposit/verify", { actor: as(customerId), body: { reference: ref } });

    expect(await depositEntries(customerId)).toHaveLength(1);
    expect(running.identity.notifications.some((note) => note.dedupeKey === `payment:${ref}:CONFIRMED`)).toBe(true);
    expect(running.signals).toContain(`wallet:${customerId}`);
  });

  it("does not let one customer verify another's deposit", async () => {
    const owner = await fixtures.customer();
    const other = await fixtures.customer();
    const ref = reference(await initiate(owner, 500_000));
    const response = await api("POST", "/api/v1/payments/deposit/verify", { actor: as(other), body: { reference: ref } });

    expect(response.status).toBe(404);
  });

  it("credits once when verify calls and webhooks race", async () => {
    const customerId = await fixtures.customer();
    const ref = reference(await initiate(customerId, 1_234_500));
    const before = await balance(customerId);

    paystack.charges.set(ref, { status: "success", amount: 1_234_500, currency: "NGN" });
    paystack.verifyDelayMs = 50;

    const first = chargeEvent(ref, 1_234_500);

    const results = await Promise.all([
      api("POST", "/api/v1/payments/deposit/verify", { actor: as(customerId), body: { reference: ref } }),
      webhook("paystack", first),
      api("POST", "/api/v1/payments/deposit/verify", { actor: as(customerId), body: { reference: ref } }),
      webhook("paystack", chargeEvent(ref, 1_234_500)),
      api("POST", "/api/v1/payments/deposit/verify", { actor: as(customerId), body: { reference: ref } }),
      webhook("paystack", first),
    ]);

    expect(results.every((result) => result.status === 200)).toBe(true);
    expect(await depositEntries(customerId)).toHaveLength(1);
    expect(await balance(customerId)).toBe(before + 1_234_500);
  });

  it("refuses a webhook whose signature does not match, before reading it", async () => {
    const customerId = await fixtures.customer();
    const ref = reference(await initiate(customerId, 500_000));

    paystack.charges.set(ref, { status: "success", amount: 500_000, currency: "NGN" });

    const forged = await webhook("paystack", chargeEvent(ref, 500_000), "0".repeat(128));
    const missing = await fetch(`http://127.0.0.1:4103/api/v1/payments/webhook/paystack`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(chargeEvent(ref, 500_000)),
    });

    expect(forged.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(await depositEntries(customerId)).toHaveLength(0);
  });

  it("refuses Bachs and unconfigured-provider webhooks", async () => {
    const bachs = await webhook("bachs", { event: "charge.success" });
    const flutterwave = await webhook("flutterwave", { event: "charge.completed" });

    expect(bachs.status).toBe(401);
    expect(flutterwave.status).toBe(401);
  });

  it("flags and does not credit when the amount does not match", async () => {
    const customerId = await fixtures.customer();
    const viaWebhook = reference(await initiate(customerId, 500_000));
    const viaVerify = reference(await initiate(customerId, 600_000));

    paystack.charges.set(viaWebhook, { status: "success", amount: 500_000, currency: "NGN" });
    paystack.charges.set(viaVerify, { status: "success", amount: 100, currency: "NGN" });

    expect((await webhook("paystack", chargeEvent(viaWebhook, 50_000))).status).toBe(200);
    await api("POST", "/api/v1/payments/deposit/verify", { actor: as(customerId), body: { reference: viaVerify } });

    const rows = await direct.prisma.payment.findMany({ where: { reference: { in: [viaWebhook, viaVerify] } } });

    expect(rows.every((row) => row.flaggedAt !== null && row.status === "PROCESSING")).toBe(true);
    expect(await depositEntries(customerId)).toHaveLength(0);

    await api("POST", "/api/v1/payments/deposit/verify", { actor: as(customerId), body: { reference: viaWebhook } });

    expect(await depositEntries(customerId)).toHaveLength(0);
  });

  it("answers a duplicate webhook quickly and does nothing twice", async () => {
    const customerId = await fixtures.customer();
    const ref = reference(await initiate(customerId, 500_000));

    paystack.charges.set(ref, { status: "success", amount: 500_000, currency: "NGN" });

    const event = chargeEvent(ref, 500_000);
    const first = await webhook("paystack", event);
    const second = await webhook("paystack", event);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((second.body as { outcome: string }).outcome).toBe("duplicate");
    expect(await depositEntries(customerId)).toHaveLength(1);
  });

  it("keeps a webhook it could not apply, replays it when the provider returns, and holds no plaintext meanwhile", async () => {
    const customerId = await fixtures.customer();
    const ref = reference(await initiate(customerId, 500_000));

    paystack.charges.set(ref, { status: "success", amount: 500_000, currency: "NGN" });
    paystack.down = true;

    const refused = await webhook("paystack", chargeEvent(ref, 500_000));

    expect(refused.status).toBeGreaterThanOrEqual(500);
    expect(await depositEntries(customerId)).toHaveLength(0);

    const queued = await direct.prisma.paymentWebhookEvent.findFirstOrThrow({ where: { paymentReference: ref } });

    expect(queued).toMatchObject({ attempts: 1, processedAt: null, abandonedAt: null, signatureVerified: true });
    expect(queued.nextAttemptAt).not.toBeNull();
    expect(queued.lastError).not.toBeNull();
    // The body is kept so it can be replayed, but never in the clear.
    expect(queued.payloadEncrypted).not.toBeNull();
    expect(queued.payloadEncrypted).not.toContain(ref);

    // Still inside its backoff: the job leaves this event alone.
    await running.app.payments.retryWebhooks(new Date(Date.now() - 60_000), "test");
    expect(
      (await direct.prisma.paymentWebhookEvent.findFirstOrThrow({ where: { paymentReference: ref } })).attempts,
    ).toBe(1);

    paystack.down = false;

    await running.app.payments.retryWebhooks(new Date(Date.now() + 60_000), "test");
    expect(await depositEntries(customerId)).toHaveLength(1);

    const settled = await direct.prisma.paymentWebhookEvent.findFirstOrThrow({ where: { paymentReference: ref } });

    expect(settled.processedAt).not.toBeNull();
    expect(settled.nextAttemptAt).toBeNull();
    // Nothing sensitive is retained once the event is done.
    expect(settled.payloadEncrypted).toBeNull();
    expect(settled.abandonedAt).toBeNull();
  });

  it("abandons a webhook once its retries run out, and counts it for an operator", async () => {
    const customerId = await fixtures.customer();
    const ref = reference(await initiate(customerId, 500_000));

    paystack.charges.set(ref, { status: "success", amount: 500_000, currency: "NGN" });
    paystack.down = true;

    const delivery = chargeEvent(ref, 500_000);

    await webhook("paystack", delivery);

    const before = await running.app.payments.abandonedWebhooks();

    // Five scheduled retries, each still failing, then the queue gives up on it.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await running.app.payments.retryWebhooks(new Date(Date.now() + 24 * 60 * 60_000), "test");
    }

    const dead = await direct.prisma.paymentWebhookEvent.findFirstOrThrow({ where: { paymentReference: ref } });

    expect(dead.attempts).toBe(6);
    expect(dead.abandonedAt).not.toBeNull();
    expect(dead.processedAt).toBeNull();
    // Abandoned means an operator owns it now; the body is not kept indefinitely.
    expect(dead.payloadEncrypted).toBeNull();
    expect(await running.app.payments.abandonedWebhooks()).toBe(before + 1);
    expect(await depositEntries(customerId)).toHaveLength(0);

    // A re-delivery of the same abandoned event must not quietly restart it.
    paystack.down = false;
    expect(((await webhook("paystack", delivery)).body as { outcome: string }).outcome).toBe("duplicate");
  });

  it("expires a stale deposit only after the provider says it was not paid", async () => {
    const customerId = await fixtures.customer();
    const unpaid = reference(await initiate(customerId, 500_000));
    const paid = reference(await initiate(customerId, 510_000));

    paystack.charges.set(paid, { status: "success", amount: 510_000, currency: "NGN" });

    await running.app.payments.expireDeposits(new Date(Date.now() + 2 * 60 * 60_000), "test");

    const rows = await direct.prisma.payment.findMany({ where: { reference: { in: [unpaid, paid] } } });

    expect(rows.find((row) => row.reference === unpaid)?.status).toBe("EXPIRED");
    expect(rows.find((row) => row.reference === paid)?.status).toBe("CONFIRMED");
    expect(await depositEntries(customerId)).toHaveLength(1);
  });

  it("maps a provider outage to PAYMENT_PROVIDER_UNAVAILABLE and replays it for the same key", async () => {
    const customerId = await fixtures.customer();
    const idempotencyKey = key();

    paystack.down = true;

    const response = await initiate(customerId, 500_000, idempotencyKey);

    paystack.down = false;

    const replay = await initiate(customerId, 500_000, idempotencyKey);

    expect(response.status).toBe(503);
    expect(errorCode(response)).toBe("PAYMENT_PROVIDER_UNAVAILABLE");
    expect(errorCode(replay)).toBe("PAYMENT_PROVIDER_UNAVAILABLE");
  });
});

describe("limits and KYC", () => {
  it("refuses when limits.check refuses, without creating a payment", async () => {
    const customerId = await fixtures.customer();

    running.identity.limit = { allowed: false, code: "LIMIT_EXCEEDED", message: "This deposit would go over your daily limit." };

    const response = await initiate(customerId, 500_000);

    expect(response.status).toBe(409);
    expect(errorCode(response)).toBe("LIMIT_EXCEEDED");
    expect(await direct.prisma.payment.count({ where: { userId: customerId } })).toBe(0);
    expect(running.identity.limitCalls.at(-1)).toEqual({ userId: customerId, action: "DEPOSIT", amount: 500_000 });
  });

  it("fails closed when identity cannot be reached", async () => {
    const customerId = await fixtures.customer();

    running.identity.unreachable = true;

    const response = await initiate(customerId, 500_000);

    expect(response.status).toBe(503);
    expect(errorCode(response)).toBe("SERVICE_UNAVAILABLE");
    expect(await direct.prisma.payment.count({ where: { userId: customerId } })).toBe(0);
  });

  it("treats an unreachable identity RPC as unavailable, never as allowed", async () => {
    const client = createRpcClient({ name: "identity", url: "http://127.0.0.1:9", timeoutMs: 500 });
    const peer = createIdentityPeer(client, createServiceLogger(await loadWalletConfig({ NODE_ENV: "test", LOG_LEVEL: "fatal", WALLET_DATABASE_URL: "postgresql://x@localhost/x?schema=wallet" })));

    await expect(peer.checkLimit(randomUUID(), "DEPOSIT", 100, "test")).rejects.toBeInstanceOf(IdentityUnavailableError);
    await expect(peer.kycStatus(randomUUID(), "test")).rejects.toBeInstanceOf(IdentityUnavailableError);
    await client.close();
  });

  it("holds deposits to the KYC tier's daily amount", async () => {
    const customerId = await fixtures.customer();

    running.identity.kyc = { status: "PENDING", tier: "TIER_1", dailyDeposit: 1_000_000, dailyWithdrawal: 0 };

    expect((await initiate(customerId, 600_000)).status).toBe(201);

    const over = await initiate(customerId, 600_000);

    expect(over.status).toBe(403);
    expect(errorCode(over)).toBe("KYC_REQUIRED");
  });
});

interface Funded {
  readonly customerId: string;
  readonly bankAccountId: string;
}

async function fundedWithBank(amount: number, accountNumber = "0123456789"): Promise<Funded> {
  const customerId = await fixtures.customer();

  if (amount > 0) {
    await direct.wallets.postEntry({ ownerType: "CUSTOMER", ownerId: customerId, type: "DEPOSIT", amount: BigInt(amount), idempotencyKey: randomUUID() });
  }

  const verified = await api("POST", "/api/v1/payments/bank-accounts/verify", {
    actor: as(customerId),
    body: { bankCode: "058", accountNumber },
  });

  expect(verified.status).toBe(200);
  expect(bankAccountVerificationSchema.safeParse(verified.body).success).toBe(true);

  const saved = await api("POST", "/api/v1/payments/bank-accounts", {
    actor: as(customerId),
    body: { verificationId: (verified.body as { verificationId: string }).verificationId },
  });

  expect(saved.status).toBe(201);

  return { customerId, bankAccountId: (saved.body as { id: string }).id };
}

async function withdraw(funded: Funded, amount: number, idempotencyKey = key()) {
  return api("POST", "/api/v1/payments/withdraw/request", {
    actor: as(funded.customerId),
    headers: { "idempotency-key": idempotencyKey },
    body: { amount, bankAccountId: funded.bankAccountId },
  });
}

async function ledgerTypes(customerId: string): Promise<string[]> {
  const account = await direct.prisma.walletAccount.findUniqueOrThrow({
    where: { ownerType_ownerId: { ownerType: "CUSTOMER", ownerId: customerId } },
  });

  return (await direct.prisma.walletTransaction.findMany({ where: { accountId: account.id }, orderBy: { sequence: "asc" } })).map((row) => row.type);
}

describe("bank accounts", () => {
  it("stores the account number only as ciphertext and lists it masked", async () => {
    const funded = await fundedWithBank(0, "0987654321");
    const row = await fixtures.superuser.$queryRaw<Record<string, unknown>[]>`
      SELECT * FROM wallet.bank_accounts WHERE id = ${funded.bankAccountId}::uuid`;
    const verifications = await fixtures.superuser.$queryRaw<Record<string, unknown>[]>`
      SELECT * FROM wallet.bank_account_verifications WHERE user_id = ${funded.customerId}::uuid`;

    expect(JSON.stringify(row)).not.toContain("0987654321");
    expect(JSON.stringify(verifications)).not.toContain("0987654321");
    expect(String(row[0]?.["account_number_encrypted"]).startsWith("v1:")).toBe(true);

    const listed = await api("GET", "/api/v1/payments/bank-accounts", { actor: as(funded.customerId) });
    const items = (listed.body as { items: unknown[] }).items;

    expect(JSON.stringify(listed.body)).not.toContain("0987654321");
    expect(items).toHaveLength(1);
    expect(bankAccountSchema.safeParse(items[0]).success).toBe(true);
    expect((items[0] as { accountNumberMasked: string; isDefault: boolean }).accountNumberMasked).toBe("******4321");
    expect((items[0] as { isDefault: boolean }).isDefault).toBe(true);
  });

  it("refuses an account the provider cannot resolve, and a verification id that is not the caller's", async () => {
    const customerId = await fixtures.customer();
    const other = await fixtures.customer();
    const unresolved = await api("POST", "/api/v1/payments/bank-accounts/verify", {
      actor: as(customerId),
      body: { bankCode: "058", accountNumber: "0001112223" },
    });

    expect(unresolved.status).toBe(422);

    const verified = await api("POST", "/api/v1/payments/bank-accounts/verify", {
      actor: as(customerId),
      body: { bankCode: "058", accountNumber: "0123456780" },
    });
    const stolen = await api("POST", "/api/v1/payments/bank-accounts", {
      actor: as(other),
      body: { verificationId: (verified.body as { verificationId: string }).verificationId },
    });
    const withName = await api("POST", "/api/v1/payments/bank-accounts", {
      actor: as(customerId),
      body: { verificationId: (verified.body as { verificationId: string }).verificationId, accountName: "Someone Else" },
    });

    expect(stolen.status).toBe(404);
    expect(withName.status).toBe(422);
  });
});

describe("withdrawals", () => {
  it("quotes with the platform's fee", async () => {
    const funded = await fundedWithBank(5_000_000);
    const quote = await api("POST", "/api/v1/payments/withdraw/quote", {
      actor: as(funded.customerId),
      body: { amount: 1_000_000, bankAccountId: funded.bankAccountId },
    });

    expect(withdrawalQuoteSchema.safeParse(quote.body).success).toBe(true);
    expect(quote.body).toMatchObject({ amount: 1_000_000, fee: 2_500, netAmount: 997_500 });
  });

  it("holds the funds, shows them pending, and returns them exactly once when the transfer fails", async () => {
    const funded = await fundedWithBank(5_000_000);
    const before = await balance(funded.customerId);
    const response = await withdraw(funded, 1_000_000);

    expect(response.status).toBe(201);
    expect(paymentRecordSchema.safeParse(response.body).success).toBe(true);

    const ref = (response.body as { reference: string }).reference;

    expect((response.body as { status: string }).status).toBe("PROCESSING");
    expect(paystack.transfers.get(ref)?.amount).toBe(997_500);

    const wallet = await api("GET", "/api/v1/wallets/me", { actor: as(funded.customerId) });

    expect(walletSchema.safeParse(wallet.body).success).toBe(true);
    expect(wallet.body).toMatchObject({ balance: before - 1_000_000, pending: 1_000_000 });

    paystack.transfers.set(ref, { status: "failed", amount: 997_500, currency: "NGN" });

    const failed = { event: "transfer.failed", data: { id: randomUUID(), reference: ref, amount: 997_500, currency: "NGN", status: "failed" } };

    expect((await webhook("paystack", failed)).body).toMatchObject({ outcome: "FAILED" });
    expect((await webhook("paystack", { ...failed, data: { ...failed.data, id: randomUUID() } })).status).toBe(200);
    await running.app.payments.pollWithdrawals("test");

    const status = await api("GET", `/api/v1/payments/withdraw/status/${ref}`, { actor: as(funded.customerId) });

    expect((status.body as { status: string }).status).toBe("FAILED");
    expect(await balance(funded.customerId)).toBe(before);
    expect((await ledgerTypes(funded.customerId)).filter((type) => type === "WITHDRAWAL_REVERSAL")).toHaveLength(1);
    expect((await api("GET", "/api/v1/wallets/me", { actor: as(funded.customerId) })).body).toMatchObject({ pending: 0 });
  });

  it("confirms through the poll job without moving money again", async () => {
    const funded = await fundedWithBank(5_000_000);
    const response = await withdraw(funded, 2_000_000);
    const ref = (response.body as { reference: string }).reference;
    const after = await balance(funded.customerId);

    paystack.transfers.set(ref, { status: "success", amount: 1_997_500, currency: "NGN" });

    for (let run = 0; run < 40; run += 1) {
      await running.app.payments.pollWithdrawals("test");

      if ((await direct.prisma.payment.findUniqueOrThrow({ where: { reference: ref } })).status === "CONFIRMED") {
        break;
      }
    }

    const status = await api("GET", `/api/v1/payments/withdraw/status/${ref}`, { actor: as(funded.customerId) });

    expect((status.body as { status: string }).status).toBe("CONFIRMED");
    expect(await balance(funded.customerId)).toBe(after);
    expect((await ledgerTypes(funded.customerId)).filter((type) => type === "WITHDRAWAL")).toHaveLength(1);
  });

  it("replays the original answer for a repeated key and refuses a changed request", async () => {
    const funded = await fundedWithBank(5_000_000);
    const idempotencyKey = key();
    const first = await withdraw(funded, 1_000_000, idempotencyKey);
    const again = await withdraw(funded, 1_000_000, idempotencyKey);
    const changed = await withdraw(funded, 1_500_000, idempotencyKey);

    expect((again.body as { reference: string }).reference).toBe((first.body as { reference: string }).reference);
    expect(changed.status).toBe(409);
    expect((await ledgerTypes(funded.customerId)).filter((type) => type === "WITHDRAWAL")).toHaveLength(1);
  });

  it("refuses more than the available balance and leaves nothing behind", async () => {
    const funded = await fundedWithBank(0);
    const response = await withdraw(funded, 100_000_000);

    expect(errorCode(response)).toBe("INSUFFICIENT_FUNDS");
    expect(await direct.prisma.payment.count({ where: { userId: funded.customerId } })).toBe(0);
  });

  it("refuses a withdrawal to someone else's bank account", async () => {
    const funded = await fundedWithBank(5_000_000);
    const other = await fundedWithBank(5_000_000);
    const response = await withdraw({ customerId: funded.customerId, bankAccountId: other.bankAccountId }, 1_000_000);

    expect(response.status).toBe(404);
  });

  it("refuses to delete a bank account while a withdrawal to it is in flight", async () => {
    const funded = await fundedWithBank(5_000_000);

    await withdraw(funded, 1_000_000);

    const refused = await api("DELETE", `/api/v1/payments/bank-accounts/${funded.bankAccountId}`, { actor: as(funded.customerId) });

    expect(refused.status).toBe(409);
  });

  it("requires KYC for withdrawals", async () => {
    const funded = await fundedWithBank(5_000_000);

    running.identity.kyc = { status: "NOT_STARTED", tier: "TIER_0", dailyDeposit: 5_000_000, dailyWithdrawal: undefined };

    const response = await withdraw(funded, 1_000_000);

    expect(errorCode(response)).toBe("KYC_REQUIRED");
  });
});

describe("admin", () => {
  const reviewer = (permissions: string[]) => ({ kind: "ADMIN" as const, id: randomUUID(), permissions });

  it("holds large withdrawals for review, enforces permission and a reason, and audits the decision", async () => {
    const funded = await fundedWithBank(100_000_000);
    const before = await balance(funded.customerId);
    const held = await withdraw(funded, 30_000_000);
    const ref = (held.body as { reference: string }).reference;

    expect((held.body as { status: string }).status).toBe("PENDING");
    expect(paystack.transfers.has(ref)).toBe(false);

    const path = `/api/v1/admin/payments/withdrawals/${ref}/review`;
    const readOnly = await api("POST", path, { actor: reviewer(["payments:read"]), body: { decision: "REJECT", reason: "Suspicious pattern" } });
    const noReason = await api("POST", path, { actor: reviewer(["payments:write"]), body: { decision: "REJECT" } });
    const asCustomer = await api("POST", path, { actor: as(funded.customerId), body: { decision: "APPROVE", reason: "Looks fine" } });

    expect(readOnly.status).toBe(403);
    expect(noReason.status).toBe(422);
    expect(asCustomer.status).toBe(403);

    running.identity.auditFails = true;

    const unaudited = await api("POST", path, { actor: reviewer(["payments:write"]), body: { decision: "REJECT", reason: "Suspicious pattern" } });

    running.identity.auditFails = false;

    expect(unaudited.status).toBe(503);
    expect((await direct.prisma.payment.findUniqueOrThrow({ where: { reference: ref } })).status).toBe("PENDING");

    const rejected = await api("POST", path, { actor: reviewer(["payments:write"]), body: { decision: "REJECT", reason: "Suspicious pattern" } });

    expect(rejected.status).toBe(200);
    expect(adminPaymentSchema.safeParse(rejected.body).success).toBe(true);
    expect((rejected.body as { status: string }).status).toBe("CANCELLED");
    expect(await balance(funded.customerId)).toBe(before);
    expect(running.identity.audits.at(-1)).toMatchObject({ action: "withdrawal_rejected", entityId: ref, reason: "Suspicious pattern" });

    const twice = await api("POST", path, { actor: reviewer(["payments:write"]), body: { decision: "APPROVE", reason: "Changed my mind" } });

    expect(twice.status).toBe(409);
    expect((await ledgerTypes(funded.customerId)).filter((type) => type === "WITHDRAWAL_REVERSAL")).toHaveLength(1);
  });

  it("sends the transfer once a held withdrawal is approved", async () => {
    const funded = await fundedWithBank(100_000_000);
    const ref = ((await withdraw(funded, 25_000_000)).body as { reference: string }).reference;
    const approved = await api("POST", `/api/v1/admin/payments/withdrawals/${ref}/review`, {
      actor: reviewer(["payments:write"]),
      body: { decision: "APPROVE", reason: "Verified by phone" },
    });

    expect(approved.status).toBe(200);
    expect((approved.body as { status: string }).status).toBe("PROCESSING");
    expect(paystack.transfers.get(ref)?.amount).toBe(25_000_000 - 5_000);
  });

  it("serves the overview and a filtered page that the admin console accepts", async () => {
    const overview = await api("GET", "/api/v1/admin/payments/overview", { actor: reviewer(["payments:read"]) });
    const page = await api("GET", "/api/v1/admin/payments?direction=WITHDRAWAL&provider=PAYSTACK&pageSize=5", {
      actor: reviewer(["payments:read"]),
    });
    const denied = await api("GET", "/api/v1/admin/payments", { actor: reviewer([]) });

    expect(paymentOverviewSchema.safeParse(overview.body).success).toBe(true);
    expect(pageSchema(adminPaymentSchema).safeParse(page.body).success).toBe(true);
    expect((page.body as { items: { direction: string }[] }).items.every((item) => item.direction === "WITHDRAWAL")).toBe(true);
    expect(denied.status).toBe(403);
  });
});

describe("history, statements and the play-money routes", () => {
  it("pages only the caller's payments", async () => {
    const customerId = await fixtures.customer();

    await initiate(customerId, 500_000);
    await initiate(customerId, 510_000);
    await initiate(await fixtures.customer(), 520_000);

    const page = await api("GET", "/api/v1/payments/history?page=1&pageSize=1&direction=DEPOSIT", { actor: as(customerId) });

    expect(pageSchema(paymentRecordSchema).safeParse(page.body).success).toBe(true);
    expect(page.body).toMatchObject({ page: 1, pageSize: 1, total: 2 });
  });

  it("ends a statement FAILED with no link when storage is not configured", async () => {
    const customerId = await fixtures.customer();
    const today = new Date().toISOString().slice(0, 10);
    const created = await api("POST", "/api/v1/account/statements", {
      actor: as(customerId),
      body: { format: "PDF", from: today, to: today },
    });

    expect(created.status).toBe(201);
    expect(statementJobSchema.safeParse(created.body).success).toBe(true);
    expect(created.body).toMatchObject({ status: "FAILED" });
    expect((created.body as { downloadUrl?: string }).downloadUrl).toBeUndefined();

    const fetched = await api("GET", `/api/v1/account/statements/${(created.body as { id: string }).id}`, { actor: as(customerId) });
    const foreign = await api("GET", `/api/v1/account/statements/${(created.body as { id: string }).id}`, { actor: as(await fixtures.customer()) });

    expect(fetched.body).toMatchObject({ status: "FAILED" });
    expect(foreign.status).toBe(404);
  });

  it("switches off the play-money top-up beside a real provider", async () => {
    const customerId = await fixtures.customer();
    const response = await api("POST", "/api/v1/wallets/deposit", { actor: as(customerId), body: { amount: 1_000 } });

    expect(response.status).toBe(404);
  });
});
