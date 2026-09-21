import type {
  CREDIT_TYPES,
  DEBIT_TYPES,
  OWNER_TYPES,
  SHOP_ENTRY_TYPES,
} from "../constants/index.js";

export type OwnerType = (typeof OWNER_TYPES)[number];

export type CreditType = (typeof CREDIT_TYPES)[number];

export type DebitType = (typeof DEBIT_TYPES)[number];

export type ShopEntryType = (typeof SHOP_ENTRY_TYPES)[number];

export type LedgerEntryType =
  | CreditType
  | DebitType
  | "WELCOME_GRANT"
  | "OPENING_FLOAT";

export interface AccountRecord {
  readonly id: string;
  readonly ownerType: OwnerType;
  readonly ownerId: string;
  readonly balance: bigint;
  readonly reserved: bigint;
  readonly currency: string;
  readonly version: number;
  readonly frozenAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface EntryRecord {
  readonly id: string;
  readonly accountId: string;
  readonly type: LedgerEntryType;
  /** 0 for the opening entry, then the account version the entry produced: the exact order the balance moved in. */
  readonly sequence: number;
  readonly amount: bigint;
  readonly currency: string;
  readonly balanceAfter: bigint;
  readonly idempotencyKey: string;
  readonly reference: string | null;
  readonly note: string | null;
  readonly actorId: string | null;
  readonly correctsId: string | null;
  readonly createdAt: Date;
}

export interface PostEntryInput {
  readonly ownerType: OwnerType;
  readonly ownerId: string;
  readonly type: CreditType | DebitType;
  /** Signed kobo: positive credits, negative debits. */
  readonly amount: bigint;
  readonly idempotencyKey: string;
  readonly reference?: string;
  readonly note?: string;
  readonly actorId?: string;
}

export interface PostEntryResult {
  readonly account: AccountRecord;
  readonly entry: EntryRecord;
  readonly duplicate: boolean;
}

export interface ShopEntryRecord {
  readonly id: string;
  readonly shopId: string;
  readonly cashierId: string;
  readonly cashierName: string;
  readonly type: ShopEntryType;
  readonly amount: bigint;
  readonly balanceAfter: bigint;
  readonly reference: string | null;
  readonly note: string | null;
  readonly createdAt: Date;
}

export interface PlatformEntryRecord {
  readonly id: string;
  readonly ownerType: OwnerType;
  readonly ownerName: string;
  readonly type: LedgerEntryType;
  readonly amount: bigint;
  readonly reference: string | null;
  readonly createdAt: Date;
}

export interface OverviewRecord {
  readonly customerBalances: bigint;
  readonly shopFloats: bigint;
  readonly reserved: bigint;
  readonly customerAccounts: number;
  readonly shopAccounts: number;
  readonly todayDeposits: bigint;
  readonly todayWithdrawals: bigint;
  readonly entries: readonly PlatformEntryRecord[];
}

export interface TimeRange {
  readonly from: Date;
  readonly to: Date;
}

export interface WalletRepository {
  getOrOpenAccount(ownerType: OwnerType, ownerId: string): Promise<AccountRecord>;
  postEntry(input: PostEntryInput): Promise<PostEntryResult>;
  listEntries(accountId: string, limit: number): Promise<readonly EntryRecord[]>;
  listShopEntries(
    shopId: string,
    range: TimeRange,
    limit: number,
  ): Promise<readonly ShopEntryRecord[]>;
  getOverview(today: TimeRange, limit: number): Promise<OverviewRecord>;
}
