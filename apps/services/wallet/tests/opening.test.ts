import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  api,
  createFixtures,
  errorCode,
  OPENING_FLOAT,
  openRepository,
  startApp,
  WELCOME_GRANT,
} from "./support.js";
import type { DirectRepository, Fixtures, RunningApp } from "./support.js";

let fixtures: Fixtures;
let direct: DirectRepository;
let running: RunningApp;

beforeAll(async () => {
  fixtures = await createFixtures();
  direct = await openRepository();
  running = await startApp();
});

afterAll(async () => {
  await running.stop();
  await direct.close();
  await fixtures.close();
});

async function accountsOf(ownerId: string) {
  return direct.prisma.walletAccount.findMany({
    where: { ownerId },
    include: { transactions: true },
  });
}

describe("account opening", () => {
  it("grants a customer once, however many first accesses race", async () => {
    const customerId = await fixtures.customer();
    const actor = { kind: "CUSTOMER", id: customerId } as const;

    const responses = await Promise.all(
      Array.from({ length: 12 }, async () =>
        api("GET", "/api/v1/wallets/me", { actor }),
      ),
    );

    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        userId: customerId,
        ownerType: "CUSTOMER",
        balance: WELCOME_GRANT,
        reserved: 0,
        currency: "NGN",
      });
    }

    const accounts = await accountsOf(customerId);

    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.balance).toBe(BigInt(WELCOME_GRANT));
    expect(accounts[0]?.transactions).toHaveLength(1);
    expect(accounts[0]?.transactions[0]).toMatchObject({
      type: "WELCOME_GRANT",
      amount: BigInt(WELCOME_GRANT),
      balanceAfter: BigInt(WELCOME_GRANT),
      idempotencyKey: "opening",
    });
  }, 30_000);

  it("opens a shop float with the opening float, once", async () => {
    const shopId = await fixtures.shop();

    const results = await Promise.all(
      Array.from({ length: 6 }, async () =>
        running.rpc.call<unknown, { wallet: { balance: number } }>(
          "wallet.getBalance",
          { ownerType: "SHOP", ownerId: shopId },
        ),
      ),
    );

    expect(results.every((r) => r.wallet.balance === OPENING_FLOAT)).toBe(true);

    const accounts = await accountsOf(shopId);

    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.transactions.map((row) => row.type)).toEqual([
      "OPENING_FLOAT",
    ]);
  });

  it("answers 404 for an owner identity does not know, and for a customer who is not active", async () => {
    const unknown = randomUUID();
    const suspended = await fixtures.customer("SUSPENDED");

    for (const id of [unknown, suspended]) {
      const response = await api("GET", "/api/v1/wallets/me", {
        actor: { kind: "CUSTOMER", id },
      });

      expect(response.status).toBe(404);
      expect(errorCode(response)).toBe("NOT_FOUND");
      expect(await accountsOf(id)).toHaveLength(0);
    }

    await expect(
      running.rpc.call("wallet.getBalance", {
        ownerType: "SHOP",
        ownerId: unknown,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("never gives an admin user a wallet — by API or by RPC", async () => {
    const adminId = await fixtures.admin();

    const asCustomer = await api("GET", "/api/v1/wallets/me", {
      actor: { kind: "CUSTOMER", id: adminId },
    });
    const asAdmin = await api("GET", `/api/v1/wallets/${adminId}`, {
      actor: { kind: "ADMIN", id: adminId, permissions: ["wallet:read"] },
    });
    const deposit = await api("POST", "/api/v1/wallets/deposit", {
      actor: { kind: "ADMIN", id: adminId, permissions: ["wallet:read"] },
      body: { amount: 1_000 },
    });

    expect(asCustomer.status).toBe(404);
    expect(asAdmin.status).toBe(404);
    expect(deposit.status).toBe(403);

    for (const ownerType of ["CUSTOMER", "SHOP"]) {
      await expect(
        running.rpc.call("wallet.credit", {
          ownerType,
          ownerId: adminId,
          amount: 5_000,
          type: "BET_PAYOUT",
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    }

    await expect(
      running.rpc.call("wallet.credit", {
        ownerType: "ADMIN",
        ownerId: adminId,
        amount: 5_000,
        type: "BET_PAYOUT",
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "RPC_VALIDATION_ERROR" });

    expect(await accountsOf(adminId)).toHaveLength(0);
  });

  it("refuses an admin id even when the same id also exists as a customer", async () => {
    const adminId = await fixtures.admin();

    await fixtures.superuser.$executeRaw`
      INSERT INTO identity.customers (id, email, display_name, status)
      VALUES (${adminId}::uuid, 'shadow@example.test', 'Shadow', 'ACTIVE')`;

    const response = await api("GET", "/api/v1/wallets/me", {
      actor: { kind: "CUSTOMER", id: adminId },
    });

    expect(response.status).toBe(404);
    expect(await accountsOf(adminId)).toHaveLength(0);
  });
});
