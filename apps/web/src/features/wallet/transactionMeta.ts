import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, RotateCcw, Ticket, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TransactionType } from "@betng/contracts";
import type { TransactionStatus, TransactionView } from "@betng/ui-core";

export const TRANSACTION_TYPES = ["DEPOSIT", "WITHDRAWAL", "BET_STAKE", "BET_PAYOUT", "BET_REFUND"] as const satisfies readonly TransactionType[];

export const TRANSACTION_STATUSES = ["PENDING", "COMPLETED", "FAILED", "REVERSED"] as const satisfies readonly TransactionStatus[];

export interface TransactionTypeMeta {
  readonly label: string;
  readonly plural: string;
  readonly icon: LucideIcon;
}

export const TRANSACTION_TYPE_META: Readonly<Record<TransactionType, TransactionTypeMeta>> = {
  DEPOSIT: { label: "Deposit", plural: "Deposits", icon: ArrowDownToLine },
  WITHDRAWAL: { label: "Withdrawal", plural: "Withdrawals", icon: ArrowUpFromLine },
  BET_STAKE: { label: "Stake", plural: "Stakes", icon: Ticket },
  BET_PAYOUT: { label: "Payout", plural: "Payouts", icon: Trophy },
  BET_REFUND: { label: "Refund", plural: "Refunds and adjustments", icon: RotateCcw },
};

/** The platform may add a type before the clients know it; it still gets a readable label. */
export function transactionTypeMeta(type: string): TransactionTypeMeta {
  if (Object.hasOwn(TRANSACTION_TYPE_META, type)) return TRANSACTION_TYPE_META[type as TransactionType];

  const words = type.replace(/[_-]+/g, " ").trim().toLowerCase();
  const label = words === "" ? "Transaction" : words.charAt(0).toUpperCase() + words.slice(1);

  return { label, plural: label, icon: ArrowLeftRight };
}

/** A row whose type the adapter has no wording for arrives without a description; the type's label stands in. */
export function transactionDescription(transaction: TransactionView): string {
  const text = (transaction.description as string | undefined)?.trim() ?? "";

  return text === "" ? transactionTypeMeta(transaction.type).label : text;
}
