import {
  BalanceLimitError,
  IdempotencyConflictError,
  InsufficientFundsError,
  WalletFrozenError,
} from "../errors/index.js";
import type { Prisma } from "../generated/prisma/client.js";
import type { AccountRecord, EntryRecord, PostableEntryType, PostEntryResult } from "../interfaces/index.js";

const MAX_SAFE_KOBO = BigInt(Number.MAX_SAFE_INTEGER);

type AccountRow = Prisma.WalletAccountGetPayload<Record<string, never>>;

type EntryRow = Prisma.WalletTransactionGetPayload<Record<string, never>>;

export interface LedgerPost {
  readonly accountId: string;
  readonly type: PostableEntryType;
  /** Signed kobo: positive credits, negative debits. */
  readonly amount: bigint;
  readonly idempotencyKey: string;
  readonly reference?: string | undefined;
  readonly note?: string | undefined;
  readonly actorId?: string | undefined;
}

export function toAccount(row: AccountRow): AccountRecord {
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

export function toEntry(row: EntryRow): EntryRecord {
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

/**
 * The only code that changes a balance. It must run inside the caller's transaction, so a payment status change and
 * its ledger entry commit or roll back together. The account row lock serialises every post on one account.
 */
export async function postWithinTransaction(tx: Prisma.TransactionClient, post: LedgerPost): Promise<PostEntryResult> {
  if (post.amount === 0n) {
    throw new Error("A ledger entry cannot be for zero.");
  }

  await tx.$queryRaw`
    SELECT "id" FROM "wallet"."wallet_accounts"
    WHERE "id" = ${post.accountId}::uuid FOR UPDATE`;

  const account = await tx.walletAccount.findUniqueOrThrow({ where: { id: post.accountId } });

  const existing = await tx.walletTransaction.findUnique({
    where: { accountId_idempotencyKey: { accountId: account.id, idempotencyKey: post.idempotencyKey } },
  });

  if (existing !== null) {
    if (existing.type !== post.type || existing.amount !== post.amount) {
      throw new IdempotencyConflictError();
    }

    return { account: toAccount(account), entry: toEntry(existing), duplicate: true };
  }

  if (account.frozenAt !== null) {
    throw new WalletFrozenError();
  }

  const available = account.balance - account.reserved;

  if (post.amount < 0n && available + post.amount < 0n) {
    throw new InsufficientFundsError(Number(available), Number(-post.amount));
  }

  const balanceAfter = account.balance + post.amount;

  if (balanceAfter > MAX_SAFE_KOBO) {
    throw new BalanceLimitError();
  }

  const entry = await tx.walletTransaction.create({
    data: {
      accountId: account.id,
      type: post.type,
      sequence: account.version + 1,
      amount: post.amount,
      currency: account.currency,
      balanceAfter,
      idempotencyKey: post.idempotencyKey,
      reference: post.reference ?? null,
      note: post.note ?? null,
      actorId: post.actorId ?? null,
    },
  });

  const updated = await tx.walletAccount.update({
    where: { id: account.id },
    data: { balance: balanceAfter, version: { increment: 1 } },
  });

  return { account: toAccount(updated), entry: toEntry(entry), duplicate: false };
}
