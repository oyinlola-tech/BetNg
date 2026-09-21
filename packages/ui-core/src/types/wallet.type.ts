import type {
  TransactionId,
  TransactionType,
  WalletId,
} from "@betng/contracts";
import type { TransactionStatus } from "./page.type.js";

export interface WalletView {
  readonly id: WalletId;
  readonly balance: number;
  readonly reserved: number;
  readonly available: number;
  readonly pending?: number;
  readonly currency: string;
  readonly simulated: true;
}

export interface TransactionView {
  readonly id: TransactionId;
  readonly type: TransactionType;
  readonly amount: number;
  readonly balanceAfter: number;
  readonly reference?: string;
  readonly description: string;
  readonly createdAt: string;
  readonly status?: TransactionStatus;
  readonly currency?: string;
  readonly betId?: string;
}
