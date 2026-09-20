import type { TransactionId, TransactionType, WalletId } from "@betng/contracts";

export interface WalletView {
  readonly id: WalletId;
  readonly balance: number;
  readonly reserved: number;
  readonly available: number;
  readonly currency: "NGN";
  /** Always true. Surfaces in the UI so nobody mistakes this for money. */
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
}
