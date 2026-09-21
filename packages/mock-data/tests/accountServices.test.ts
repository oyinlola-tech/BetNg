import { describe, expect, it } from "vitest";
import type { CustomerSession } from "@betng/contracts";
import { createSessionStore } from "@betng/ui-core";
import { MOCK_TOTP_CODE, createMockAccountServices } from "../src/account/index.js";
import { createMockAuthSource } from "../src/auth/index.js";

function setup(balance = 1_000_000) {
  const auth = createMockAuthSource({ latencyMs: 0 });
  const wallet = { balance };
  const services = createMockAccountServices({
    session: auth.session,
    latencyMs: 0,
    wallet: { available: () => wallet.balance, credit: (n) => void (wallet.balance += n), debit: (n) => void (wallet.balance -= n) },
  });

  return { auth, wallet, services };
}

describe("account services stand-in", () => {
  it("refuses everything without a session", async () => {
    const services = createMockAccountServices({ session: createSessionStore<CustomerSession>("x"), latencyMs: 0, wallet: { available: () => 0, credit: () => undefined, debit: () => undefined } });

    await expect(services.limits.getSummary()).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
  });

  it("credits the wallet only once a deposit is confirmed, and replays the same key", async () => {
    const { auth, wallet, services } = setup();

    await auth.login({ email: "demo@betng.test", password: "betng-demo" });

    const first = await services.payments.initiateDeposit({ amount: 50_000, method: "CARD" }, "k1");
    const again = await services.payments.initiateDeposit({ amount: 50_000, method: "CARD" }, "k1");

    expect(again.payment.reference).toBe(first.payment.reference);
    expect(wallet.balance).toBe(1_000_000);
    expect((await services.payments.verifyDeposit(first.payment.reference)).status).toBe("PROCESSING");
    expect(wallet.balance).toBe(1_000_000);
    expect((await services.payments.verifyDeposit(first.payment.reference)).status).toBe("CONFIRMED");
    expect(wallet.balance).toBe(1_050_000);
    expect((await services.payments.verifyDeposit(first.payment.reference)).status).toBe("CONFIRMED");
    expect(wallet.balance).toBe(1_050_000);
  });

  it("fails a deposit ending in 13 kobo without crediting", async () => {
    const { auth, wallet, services } = setup();

    await auth.login({ email: "demo@betng.test", password: "betng-demo" });

    const { payment } = await services.payments.initiateDeposit({ amount: 50_013, method: "CARD" }, "k2");

    await services.payments.verifyDeposit(payment.reference);
    expect((await services.payments.verifyDeposit(payment.reference)).status).toBe("FAILED");
    expect(wallet.balance).toBe(1_000_000);
  });

  it("blocks deposits while self-excluded", async () => {
    const { auth, services } = setup();

    await auth.login({ email: "demo@betng.test", password: "betng-demo" });
    await services.limits.selfExclude({ period: "24h", password: "betng-demo" });

    await expect(services.payments.initiateDeposit({ amount: 1_000, method: "CARD" }, "k3")).rejects.toMatchObject({ code: "SELF_EXCLUDED" });
    expect((await services.limits.getSummary()).restricted).toBe(true);
  });

  it("applies a tighter limit at once and holds a looser one", async () => {
    const { auth, services } = setup();

    await auth.login({ email: "demo@betng.test", password: "betng-demo" });
    await services.limits.setLimit({ kind: "deposit_daily", value: 100_000 });

    const raised = await services.limits.setLimit({ kind: "deposit_daily", value: 500_000 });

    expect(raised.limits[0]).toMatchObject({ status: "pending", value: 100_000, pendingValue: 500_000 });
  });

  it("asks for a second factor after 2FA is turned on", async () => {
    const { auth, services } = setup();

    await auth.login({ email: "demo@betng.test", password: "betng-demo" });

    const enrollment = await services.security.startTwoFactorEnrollment();
    const backup = await services.security.confirmTwoFactor({ enrollmentId: enrollment.enrollmentId, code: MOCK_TOTP_CODE });

    await auth.logout();

    const challenge = await auth.login({ email: "demo@betng.test", password: "betng-demo" }).catch((error: unknown) => error);

    expect(challenge).toMatchObject({ code: "TWO_FACTOR_REQUIRED" });

    const challengeId = (challenge as { detail: { challenge: { challengeId: string } } }).detail.challenge.challengeId;

    await expect(auth.completeTwoFactor({ challengeId, code: "000000" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(auth.completeTwoFactor({ challengeId, code: backup.codes[0] as string })).resolves.toMatchObject({ user: { email: "demo@betng.test" } });
  });
});
