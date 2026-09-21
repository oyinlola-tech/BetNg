import { randomUUID } from "node:crypto";
import { isDomainError } from "@zudojs/errors";
import { toDatabaseErrorInfo } from "@zudojs/database";
import type { Logger } from "@betng/service-kit";
import type { WalletSettings } from "../configs/index.js";
import { OPENING_IDEMPOTENCY_KEY } from "../constants/index.js";
import {
  BalanceLimitError,
  IdempotencyConflictError,
  InsufficientFundsError,
  WalletDatabaseError,
  WalletFrozenError,
  WalletOwnerNotFoundError,
} from "../errors/index.js";
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import type {
  AccountRecord,
  EntryRecord,
  LedgerEntryType,
  OverviewRecord,
  OwnerType,
  PlatformEntryRecord,
  PostEntryInput,
  PostEntryResult,
  ShopEntryRecord,
  ShopEntryType,
  TimeRange,
  WalletRepository,
} from "../interfaces/index.js";

/** Debits on one account queue behind its row lock, so a burst needs longer than Prisma's 2 s default. */
const TRANSACTION_OPTIONS = Object.freeze({ maxWait: 10_000, timeout: 15_000 });

const MAX_SAFE_KOBO = BigInt(Number.MAX_SAFE_INTEGER);

const ACTIVE_CUSTOMER_STATUS = "ACTIVE";

type AccountRow = Prisma.WalletAccountGetPayload<Record<string, never>>;

type EntryRow = Prisma.WalletTransactionGetPayload<Record<string, never>>;

interface ShopEntryRow {
  readonly id: string;
  readonly shop_id: string;
  readonly actor_id: string;
  readonly cashier_name: string;
  readonly type: ShopEntryType;
  readonly amount: bigint;
  readonly balance_after: bigint;
  readonly reference: string | null;
  readonly note: string | null;
  readonly created_at: Date;
}

interface TotalsRow {
  readonly owner_type: OwnerType;
  readonly balance: bigint;
  readonly reserved: bigint;
  readonly accounts: number;
}

interface TodayRow {
  readonly deposits: bigint;
  readonly withdrawals: bigint;
}

interface PlatformEntryRow {
  readonly id: string;
  readonly owner_type: OwnerType;
  readonly owner_name: string;
  readonly type: LedgerEntryType;
  readonly amount: bigint;
  readonly reference: string | null;
  readonly created_at: Date;
}

function toAccount(row: AccountRow): AccountRecord {
  return {
    id: row.id,
    ownerType: row.ownerType,
    ownerId: row.ownerId,
    balance: row.balance,
    reserved: row.reserved,
    currency: row.currency,
    version: row.version,
    frozenAt: row.frozenAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toEntry(row: EntryRow): EntryRecord {
  return {
    id: row.id,
    accountId: row.accountId,
    type: row.type,
    sequence: row.sequence,
    amount: row.amount,
    currency: row.currency,
    balanceAfter: row.balanceAfter,
    idempotencyKey: row.idempotencyKey,
    reference: row.reference,
    note: row.note,
    actorId: row.actorId,
    correctsId: row.correctsId,
    createdAt: row.createdAt,
  };
}

/** An admin id is refused first: the operator's result lives in settlement's operator ledger, never in a wallet. */
async function assertOwnerMayHoldAccount(
  tx: Prisma.TransactionClient,
  ownerType: OwnerType,
  ownerId: string,
): Promise<void> {
  const admins = await tx.$queryRaw<unknown[]>`
    SELECT 1 FROM "identity"."admin_users" WHERE "id" = ${ownerId}::uuid LIMIT 1`;

  if (admins.length > 0) {
    throw new WalletOwnerNotFoundError();
  }

  if (ownerType === "CUSTOMER") {
    const customers = await tx.$queryRaw<{ status: string }[]>`
      SELECT "status"::text AS "status" FROM "identity"."customers"
      WHERE "id" = ${ownerId}::uuid LIMIT 1`;

    if (customers[0]?.status !== ACTIVE_CUSTOMER_STATUS) {
      throw new WalletOwnerNotFoundError();
    }

    return;
  }

  const shops = await tx.$queryRaw<unknown[]>`
    SELECT 1 FROM "identity"."shops" WHERE "id" = ${ownerId}::uuid LIMIT 1`;

  if (shops.length === 0) {
    throw new WalletOwnerNotFoundError();
  }
}

export function createWalletRepository(
  prisma: PrismaClient,
  settings: WalletSettings,
  logger: Logger,
): WalletRepository {
  /** Domain errors pass through; anything else is logged here and surfaces as DATABASE_UNAVAILABLE without detail. */
  async function guarded<T>(
    operation: string,
    run: () => Promise<T>,
  ): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (isDomainError(error)) {
        throw error;
      }

      logger.error("Wallet database operation failed", {
        operation,
        error: { ...toDatabaseErrorInfo(error) },
      });

      throw new WalletDatabaseError(error);
    }
  }

  async function findAccount(
    client: Prisma.TransactionClient | PrismaClient,
    ownerType: OwnerType,
    ownerId: string,
  ): Promise<AccountRecord | undefined> {
    const row = await client.walletAccount.findUnique({
      where: { ownerType_ownerId: { ownerType, ownerId } },
    });

    return row === null ? undefined : toAccount(row);
  }

  /** `ON CONFLICT DO NOTHING`: a concurrent first access waits for the winner's commit and posts no second grant. */
  async function openAccount(
    ownerType: OwnerType,
    ownerId: string,
  ): Promise<AccountRecord> {
    return prisma.$transaction(async (tx) => {
      await assertOwnerMayHoldAccount(tx, ownerType, ownerId);

      const id = randomUUID();
      const grant =
        ownerType === "CUSTOMER"
          ? settings.welcomeGrantKobo
          : settings.shopOpeningFloatKobo;

      const inserted = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO "wallet"."wallet_accounts"
          ("id", "owner_type", "owner_id", "balance", "updated_at")
        VALUES
          (${id}::uuid, ${ownerType}::"wallet"."owner_type", ${ownerId}::uuid,
           ${grant}::bigint, now())
        ON CONFLICT ("owner_type", "owner_id") DO NOTHING
        RETURNING "id"`;

      if (inserted.length > 0 && grant > 0n) {
        await tx.walletTransaction.create({
          data: {
            accountId: id,
            type: ownerType === "CUSTOMER" ? "WELCOME_GRANT" : "OPENING_FLOAT",
            sequence: 0,
            amount: grant,
            currency: "NGN",
            balanceAfter: grant,
            idempotencyKey: OPENING_IDEMPOTENCY_KEY,
          },
        });
      }

      const account = await findAccount(tx, ownerType, ownerId);

      if (account === undefined) {
        throw new Error("The account was not visible after it was opened.");
      }

      return account;
    }, TRANSACTION_OPTIONS);
  }

  async function getOrOpenAccount(
    ownerType: OwnerType,
    ownerId: string,
  ): Promise<AccountRecord> {
    return (
      (await findAccount(prisma, ownerType, ownerId)) ??
      (await openAccount(ownerType, ownerId))
    );
  }

  async function postEntry(input: PostEntryInput): Promise<PostEntryResult> {
    if (input.amount === 0n) {
      throw new Error("A ledger entry cannot be for zero.");
    }

    const opened = await getOrOpenAccount(input.ownerType, input.ownerId);

    return prisma.$transaction(async (tx) => {
      // Row lock: the idempotency check, funds check, insert and balance update see one consistent account.
      await tx.$queryRaw`
        SELECT "id" FROM "wallet"."wallet_accounts"
        WHERE "id" = ${opened.id}::uuid FOR UPDATE`;

      const account = await tx.walletAccount.findUniqueOrThrow({
        where: { id: opened.id },
      });

      const existing = await tx.walletTransaction.findUnique({
        where: {
          accountId_idempotencyKey: {
            accountId: account.id,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });

      if (existing !== null) {
        if (existing.type !== input.type || existing.amount !== input.amount) {
          throw new IdempotencyConflictError();
        }

        return {
          account: toAccount(account),
          entry: toEntry(existing),
          duplicate: true,
        };
      }

      if (account.frozenAt !== null) {
        throw new WalletFrozenError();
      }

      const available = account.balance - account.reserved;

      if (input.amount < 0n && available + input.amount < 0n) {
        throw new InsufficientFundsError(
          Number(available),
          Number(-input.amount),
        );
      }

      const balanceAfter = account.balance + input.amount;

      if (balanceAfter > MAX_SAFE_KOBO) {
        throw new BalanceLimitError();
      }

      const entry = await tx.walletTransaction.create({
        data: {
          accountId: account.id,
          type: input.type,
          sequence: account.version + 1,
          amount: input.amount,
          currency: account.currency,
          balanceAfter,
          idempotencyKey: input.idempotencyKey,
          reference: input.reference ?? null,
          note: input.note ?? null,
          actorId: input.actorId ?? null,
        },
      });

      const updated = await tx.walletAccount.update({
        where: { id: account.id },
        data: { balance: balanceAfter, version: { increment: 1 } },
      });

      return {
        account: toAccount(updated),
        entry: toEntry(entry),
        duplicate: false,
      };
    }, TRANSACTION_OPTIONS);
  }

  async function listEntries(
    accountId: string,
    limit: number,
  ): Promise<readonly EntryRecord[]> {
    const rows = await prisma.walletTransaction.findMany({
      where: { accountId },
      orderBy: { sequence: "desc" },
      take: limit,
    });

    return rows.map(toEntry);
  }

  async function listShopEntries(
    shopId: string,
    range: TimeRange,
    limit: number,
  ): Promise<readonly ShopEntryRecord[]> {
    const rows = await prisma.$queryRaw<ShopEntryRow[]>`
      SELECT t."id", a."owner_id" AS "shop_id", t."actor_id",
             COALESCE(c."display_name", '') AS "cashier_name",
             t."type"::text AS "type", t."amount", t."balance_after",
             t."reference", t."note", t."created_at"
      FROM "wallet"."wallet_transactions" t
      JOIN "wallet"."wallet_accounts" a ON a."id" = t."account_id"
      LEFT JOIN "identity"."cashiers" c
        ON c."id"::text = t."actor_id" AND c."shop_id" = a."owner_id"
      WHERE a."owner_type" = 'SHOP'
        AND a."owner_id" = ${shopId}::uuid
        AND t."type" IN ('TICKET_SALE', 'TICKET_PAYOUT', 'TICKET_CANCEL', 'CASH_IN', 'CASH_OUT')
        AND t."created_at" >= ${range.from}::timestamptz
        AND t."created_at" < ${range.to}::timestamptz
      ORDER BY t."sequence" DESC
      LIMIT ${limit}::int`;

    return rows.map((row) => ({
      id: row.id,
      shopId: row.shop_id,
      cashierId: row.actor_id,
      cashierName: row.cashier_name,
      type: row.type,
      amount: row.amount,
      balanceAfter: row.balance_after,
      reference: row.reference,
      note: row.note,
      createdAt: row.created_at,
    }));
  }

  async function getOverview(
    today: TimeRange,
    limit: number,
  ): Promise<OverviewRecord> {
    const totals = await prisma.$queryRaw<TotalsRow[]>`
      SELECT "owner_type"::text AS "owner_type",
             COALESCE(SUM("balance"), 0)::bigint AS "balance",
             COALESCE(SUM("reserved"), 0)::bigint AS "reserved",
             COUNT(*)::int AS "accounts"
      FROM "wallet"."wallet_accounts"
      GROUP BY "owner_type"`;

    const day = await prisma.$queryRaw<TodayRow[]>`
      SELECT COALESCE(SUM("amount") FILTER (WHERE "type" IN ('DEPOSIT', 'CASH_IN')), 0)::bigint
               AS "deposits",
             COALESCE(-SUM("amount") FILTER (WHERE "type" IN ('WITHDRAWAL', 'CASH_OUT')), 0)::bigint
               AS "withdrawals"
      FROM "wallet"."wallet_transactions"
      WHERE "created_at" >= ${today.from}::timestamptz
        AND "created_at" < ${today.to}::timestamptz`;

    const entries = await prisma.$queryRaw<PlatformEntryRow[]>`
      SELECT t."id", a."owner_type"::text AS "owner_type",
             COALESCE(cu."display_name", s."name", '') AS "owner_name",
             t."type"::text AS "type", t."amount", t."reference", t."created_at"
      FROM "wallet"."wallet_transactions" t
      JOIN "wallet"."wallet_accounts" a ON a."id" = t."account_id"
      LEFT JOIN "identity"."customers" cu
        ON a."owner_type" = 'CUSTOMER' AND cu."id" = a."owner_id"
      LEFT JOIN "identity"."shops" s
        ON a."owner_type" = 'SHOP' AND s."id" = a."owner_id"
      ORDER BY t."created_at" DESC, t."id" DESC
      LIMIT ${limit}::int`;

    const customers = totals.find((row) => row.owner_type === "CUSTOMER");
    const shops = totals.find((row) => row.owner_type === "SHOP");

    return {
      customerBalances: customers?.balance ?? 0n,
      shopFloats: shops?.balance ?? 0n,
      reserved: (customers?.reserved ?? 0n) + (shops?.reserved ?? 0n),
      customerAccounts: customers?.accounts ?? 0,
      shopAccounts: shops?.accounts ?? 0,
      todayDeposits: day[0]?.deposits ?? 0n,
      todayWithdrawals: day[0]?.withdrawals ?? 0n,
      entries: entries.map(
        (row): PlatformEntryRecord => ({
          id: row.id,
          ownerType: row.owner_type,
          ownerName: row.owner_name,
          type: row.type,
          amount: row.amount,
          reference: row.reference,
          createdAt: row.created_at,
        }),
      ),
    };
  }

  return {
    getOrOpenAccount: async (ownerType, ownerId) =>
      guarded("getOrOpenAccount", async () =>
        getOrOpenAccount(ownerType, ownerId),
      ),
    postEntry: async (input) => guarded("postEntry", async () => postEntry(input)),
    listEntries: async (accountId, limit) =>
      guarded("listEntries", async () => listEntries(accountId, limit)),
    listShopEntries: async (shopId, range, limit) =>
      guarded("listShopEntries", async () =>
        listShopEntries(shopId, range, limit),
      ),
    getOverview: async (today, limit) =>
      guarded("getOverview", async () => getOverview(today, limit)),
  };
}
