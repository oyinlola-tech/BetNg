import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  IdempotencyConflictError,
  InsufficientFundsError,
} from "../src/errors/index.js";
import type { PostEntryInput } from "../src/interfaces/index.js";
import {
  createFixtures,
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

function entry(
  ownerId: string,
  type: PostEntryInput["type"],
  amount: bigint,
  idempotencyKey: string = randomUUID(),
): PostEntryInput {
  return { ownerType: "CUSTOMER", ownerId, type, amount, idempotencyKey };
}

async function ledgerOf(accountId: string) {
  return direct.prisma.walletTransaction.findMany({
    where: { accountId },
    orderBy: { sequence: "asc" },
  });
}

describe("the ledger", () => {
  it("keeps the balance equal to the sum of its entries, with a consistent balance_after chain", async () => {
    const customerId = await fixtures.customer();
    const movements: [PostEntryInput["type"], bigint][] = [
      ["BET_STAKE", -250_000n],
      ["BET_PAYOUT", 725_000n],
      ["WITHDRAWAL", -1_000_000n],
      ["DEPOSIT", 40_000n],
      ["BET_REFUND", 250_000n],
      ["ADJUSTMENT", -15n],
    ];

    let last = await direct.wallets.getOrOpenAccount("CUSTOMER", customerId);

    for (const [type, amount] of movements) {
      last = (await direct.wallets.postEntry(entry(customerId, type, amount)))
        .account;
    }

    const rows = await ledgerOf(last.id);
    const sum = rows.reduce((total, row) => total + row.amount, 0n);

    expect(rows).toHaveLength(movements.length + 1);
    expect(rows[0]?.type).toBe("WELCOME_GRANT");
    expect(sum).toBe(last.balance);
    expect(last.balance).toBe(BigInt(WELCOME_GRANT) - 235_015n);
    expect(rows.map((row) => row.sequence)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(last.version).toBe(movements.length);

    let running = 0n;

    for (const row of rows) {
      running += row.amount;
      expect(row.balanceAfter).toBe(running);
    }
  });

  it("answers an idempotent replay with duplicate: true and moves nothing", async () => {
    const customerId = await fixtures.customer();
    const key = `bet:${randomUUID()}`;

    const first = await direct.wallets.postEntry(
      entry(customerId, "BET_STAKE", -500_000n, key),
    );
    const replay = await direct.wallets.postEntry(
      entry(customerId, "BET_STAKE", -500_000n, key),
    );

    expect(first.duplicate).toBe(false);
    expect(replay.duplicate).toBe(true);
    expect(replay.entry.id).toBe(first.entry.id);
    expect(replay.account.balance).toBe(first.account.balance);
    expect(replay.account.version).toBe(first.account.version);
    expect(await ledgerOf(first.account.id)).toHaveLength(2);
  });

  it("refuses a key that was used for a different entry", async () => {
    const customerId = await fixtures.customer();
    const key = `bet:${randomUUID()}`;

    await direct.wallets.postEntry(entry(customerId, "BET_STAKE", -100n, key));

    await expect(
      direct.wallets.postEntry(entry(customerId, "BET_STAKE", -999n, key)),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
  });

  it("refuses an overdraft and writes no row", async () => {
    const customerId = await fixtures.customer();
    const account = await direct.wallets.getOrOpenAccount(
      "CUSTOMER",
      customerId,
    );

    await expect(
      direct.wallets.postEntry(
        entry(customerId, "BET_STAKE", -BigInt(WELCOME_GRANT) - 1n),
      ),
    ).rejects.toBeInstanceOf(InsufficientFundsError);

    const after = await direct.wallets.getOrOpenAccount("CUSTOMER", customerId);

    expect(after.balance).toBe(account.balance);
    expect(after.version).toBe(account.version);
    expect(await ledgerOf(account.id)).toHaveLength(1);
  });

  it("lets exactly 10 of 25 concurrent debits through when the account affords 10", async () => {
    const customerId = await fixtures.customer();
    const stake = WELCOME_GRANT / 10;

    const outcomes = await Promise.allSettled(
      Array.from({ length: 25 }, async (_, index) =>
        running.rpc.call("wallet.debit", {
          ownerType: "CUSTOMER",
          ownerId: customerId,
          amount: stake,
          type: "BET_STAKE",
          idempotencyKey: `stake:${customerId}:${String(index)}`,
        }),
      ),
    );

    const accepted = outcomes.filter((outcome) => outcome.status === "fulfilled");
    const refused = outcomes.filter(
      (outcome): outcome is PromiseRejectedResult =>
        outcome.status === "rejected",
    );

    expect(accepted).toHaveLength(10);
    expect(refused).toHaveLength(15);

    for (const outcome of refused) {
      expect((outcome.reason as { code?: string }).code).toBe(
        "INSUFFICIENT_FUNDS",
      );
    }

    const account = await direct.wallets.getOrOpenAccount(
      "CUSTOMER",
      customerId,
    );
    const rows = await ledgerOf(account.id);

    expect(account.balance).toBe(0n);
    expect(rows).toHaveLength(11);
    expect(rows.every((row) => row.balanceAfter >= 0n)).toBe(true);
    expect(rows.reduce((total, row) => total + row.amount, 0n)).toBe(0n);
  }, 60_000);
});

describe("database invariants", () => {
  async function openedAccount(): Promise<string> {
    const customerId = await fixtures.customer();

    return (await direct.wallets.getOrOpenAccount("CUSTOMER", customerId)).id;
  }

  it("rejects UPDATE and DELETE on wallet_transactions, even for the superuser", async () => {
    const accountId = await openedAccount();

    await expect(
      fixtures.superuser.$executeRaw`
        UPDATE wallet.wallet_transactions SET amount = 1 WHERE account_id = ${accountId}::uuid`,
    ).rejects.toThrow(/append-only/);

    await expect(
      fixtures.superuser.$executeRaw`
        DELETE FROM wallet.wallet_transactions WHERE account_id = ${accountId}::uuid`,
    ).rejects.toThrow(/append-only/);

    expect(await ledgerOf(accountId)).toHaveLength(1);
  });

  it("rejects an entry whose sign contradicts its type", async () => {
    const accountId = await openedAccount();

    await expect(
      direct.prisma.walletTransaction.create({
        data: {
          accountId,
          type: "BET_STAKE",
          sequence: 1,
          amount: 500n,
          currency: "NGN",
          balanceAfter: 500n,
          idempotencyKey: randomUUID(),
        },
      }),
    ).rejects.toThrow(/wallet_transactions_sign_matches_type/);

    await expect(
      direct.prisma.walletTransaction.create({
        data: {
          accountId,
          type: "TICKET_SALE",
          sequence: 1,
          amount: -500n,
          currency: "NGN",
          balanceAfter: 500n,
          idempotencyKey: randomUUID(),
          actorId: randomUUID(),
        },
      }),
    ).rejects.toThrow(/wallet_transactions_sign_matches_type/);
  });

  it("rejects a negative balance and a reservation above the balance", async () => {
    const accountId = await openedAccount();

    await expect(
      direct.prisma.walletAccount.update({
        where: { id: accountId },
        data: { balance: -1n },
      }),
    ).rejects.toThrow(/wallet_accounts_balance_non_negative/);

    await expect(
      direct.prisma.walletAccount.update({
        where: { id: accountId },
        data: { reserved: BigInt(WELCOME_GRANT) + 1n },
      }),
    ).rejects.toThrow(/wallet_accounts_reserved_within_balance/);
  });

  it("has no owner type besides CUSTOMER and SHOP, and never re-homes an account", async () => {
    const accountId = await openedAccount();

    await expect(
      fixtures.superuser.$executeRaw`
        INSERT INTO wallet.wallet_accounts (id, owner_type, owner_id, updated_at)
        VALUES (${randomUUID()}::uuid, 'ADMIN', ${randomUUID()}::uuid, now())`,
    ).rejects.toThrow(/owner_type/);

    await expect(
      direct.prisma.walletAccount.update({
        where: { id: accountId },
        data: { ownerId: randomUUID() },
      }),
    ).rejects.toThrow(/immutable/);
  });
});
