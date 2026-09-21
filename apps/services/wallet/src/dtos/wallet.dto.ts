import type {
  PlatformLedgerEntry,
  PlatformWalletOverview,
  ShopTransaction,
  Transaction,
  Wallet,
} from "@betng/contracts";
import type { LedgerEntryType, OwnerType } from "../interfaces/index.js";

/** The contract's `Wallet` plus optional fields. For a shop float, `userId` carries the shop id. */
export interface WalletDto extends Wallet {
  readonly ownerType: OwnerType;
  readonly available: number;
}

/** `type` is wider than the contract's five: the ledger also records grants, floats, counter transactions and adjustments. */
export interface TransactionDto extends Omit<Transaction, "type"> {
  readonly type: LedgerEntryType;
  readonly note?: string;
  readonly actorId?: string;
}

export interface LedgerEntryDto {
  readonly wallet: WalletDto;
  readonly transaction: TransactionDto;
}

export interface PostEntryDto extends LedgerEntryDto {
  readonly duplicate: boolean;
}

export interface BalanceDto {
  readonly wallet: WalletDto;
}

export interface TransactionListDto {
  readonly items: readonly TransactionDto[];
}

export interface ShopTransactionListDto {
  readonly items: readonly ShopTransaction[];
}

/** The contract's five display types are a projection; `ledgerType` is the entry's exact type. */
export interface PlatformLedgerEntryDto extends PlatformLedgerEntry {
  readonly ledgerType: LedgerEntryType;
}

export interface WalletOverviewDto extends PlatformWalletOverview {
  readonly entries: PlatformLedgerEntryDto[];
  readonly customerAccounts: number;
  readonly shopAccounts: number;
}
