import { asId } from "@betng/contracts";
import type { Currency, ShopTransaction, TransactionType } from "@betng/contracts";
import { ENTRY_STATUS } from "../constants/index.js";
import type {
  PagedTransactionDto,
  PlatformLedgerEntryDto,
  TransactionDto,
  WalletDto,
  WalletOverviewDto,
} from "../dtos/index.js";
import type {
  AccountRecord,
  EntryRecord,
  EntryTypeFilter,
  LedgerEntryType,
  OverviewRecord,
  PlatformEntryRecord,
  ShopEntryRecord,
} from "../interfaces/index.js";

/** The one place a bigint becomes a JSON integer; it refuses to do so lossily. */
export function toKobo(value: bigint): number {
  const kobo = Number(value);

  if (!Number.isSafeInteger(kobo)) {
    throw new Error("A ledger amount is outside the safe integer range.");
  }

  return kobo;
}

export function toWalletDto(account: AccountRecord): WalletDto {
  return {
    id: asId<"WalletId">(account.id),
    userId: asId<"UserId">(account.ownerId),
    ownerType: account.ownerType,
    balance: toKobo(account.balance),
    reserved: toKobo(account.reserved),
    available: toKobo(account.balance - account.reserved),
    currency: account.currency as Currency,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

export function toTransactionDto(entry: EntryRecord): TransactionDto {
  return {
    id: asId<"TransactionId">(entry.id),
    walletId: asId<"WalletId">(entry.accountId),
    type: entry.type,
    amount: toKobo(entry.amount),
    currency: entry.currency as Currency,
    balanceAfter: toKobo(entry.balanceAfter),
    ...(entry.reference === null ? {} : { reference: entry.reference }),
    ...(entry.note === null ? {} : { note: entry.note }),
    ...(entry.actorId === null ? {} : { actorId: entry.actorId }),
    createdAt: entry.createdAt.toISOString(),
  };
}

export function toPagedTransactionDto(entry: EntryRecord): PagedTransactionDto {
  return { ...toTransactionDto(entry), status: ENTRY_STATUS };
}

export function toShopTransaction(entry: ShopEntryRecord): ShopTransaction {
  return {
    id: entry.id,
    shopId: asId<"ShopId">(entry.shopId),
    cashierId: asId<"CashierId">(entry.cashierId),
    cashierName: entry.cashierName,
    type: entry.type,
    amount: toKobo(entry.amount),
    balanceAfter: toKobo(entry.balanceAfter),
    ...(entry.reference === null ? {} : { reference: entry.reference }),
    ...(entry.note === null ? {} : { note: entry.note }),
    createdAt: entry.createdAt.toISOString(),
  };
}

type PlatformDisplayType = PlatformLedgerEntryDto["type"];

const DISPLAY_TYPE: Readonly<
  Record<Exclude<LedgerEntryType, "ADJUSTMENT">, PlatformDisplayType>
> = Object.freeze({
  DEPOSIT: "DEPOSIT",
  WELCOME_GRANT: "DEPOSIT",
  OPENING_FLOAT: "DEPOSIT",
  CASH_IN: "DEPOSIT",
  WITHDRAWAL: "WITHDRAWAL",
  CASH_OUT: "WITHDRAWAL",
  BET_STAKE: "STAKE",
  TICKET_SALE: "STAKE",
  BET_PAYOUT: "PAYOUT",
  TICKET_PAYOUT: "PAYOUT",
  BET_REFUND: "REFUND",
  TICKET_CANCEL: "REFUND",
  WITHDRAWAL_REVERSAL: "REFUND",
});

const CONTRACT_DISPLAY: Readonly<Record<TransactionType, PlatformDisplayType>> = Object.freeze({
  DEPOSIT: "DEPOSIT",
  WITHDRAWAL: "WITHDRAWAL",
  BET_STAKE: "STAKE",
  BET_PAYOUT: "PAYOUT",
  BET_REFUND: "REFUND",
});

function isContractType(type: LedgerEntryType): type is TransactionType {
  return type in CONTRACT_DISPLAY;
}

/** One of the contract's five types selects every ledger type projected onto it; any other type selects itself. */
export function toEntryTypeFilter(requested: readonly LedgerEntryType[]): EntryTypeFilter {
  const ledger = new Set<LedgerEntryType>();
  let adjustmentCredits = false;
  let adjustmentDebits = false;

  for (const type of requested) {
    if (!isContractType(type)) {
      ledger.add(type);
      continue;
    }

    const display = CONTRACT_DISPLAY[type];

    for (const [ledgerType, projected] of Object.entries(DISPLAY_TYPE)) {
      if (projected === display) {
        ledger.add(ledgerType as LedgerEntryType);
      }
    }

    adjustmentCredits ||= display === "DEPOSIT";
    adjustmentDebits ||= display === "WITHDRAWAL";
  }

  return { ledger: [...ledger], adjustmentCredits, adjustmentDebits };
}

function toPlatformEntry(entry: PlatformEntryRecord): PlatformLedgerEntryDto {
  const displayType =
    entry.type === "ADJUSTMENT"
      ? entry.amount > 0n
        ? "DEPOSIT"
        : "WITHDRAWAL"
      : DISPLAY_TYPE[entry.type];

  return {
    id: entry.id,
    owner: entry.ownerName,
    channel: entry.ownerType === "SHOP" ? "SHOP" : "ONLINE",
    type: displayType,
    ledgerType: entry.type,
    amount: toKobo(entry.amount),
    ...(entry.reference === null ? {} : { reference: entry.reference }),
    createdAt: entry.createdAt.toISOString(),
  };
}

export function toWalletOverviewDto(overview: OverviewRecord): WalletOverviewDto {
  return {
    customerBalances: toKobo(overview.customerBalances),
    shopFloats: toKobo(overview.shopFloats),
    reserved: toKobo(overview.reserved),
    customerAccounts: overview.customerAccounts,
    shopAccounts: overview.shopAccounts,
    todayDeposits: toKobo(overview.todayDeposits),
    todayWithdrawals: toKobo(overview.todayWithdrawals),
    entries: overview.entries.map(toPlatformEntry),
  };
}
