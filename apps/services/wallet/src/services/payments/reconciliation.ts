import type { ProviderOutcome } from "../../providers/index.js";

export type ReconciliationVerdict =
  | { readonly kind: "AGREES" }
  /** The provider has not finished with it; ask again on a later run. */
  | { readonly kind: "WAIT" }
  /** The provider returned a paid-out transfer: the existing reversal path credits it back. */
  | { readonly kind: "SETTLE" }
  | { readonly kind: "FLAG"; readonly reason: string };

export interface ClosedPayment {
  readonly direction: string;
  readonly status: string;
  readonly amount: bigint;
  readonly netAmount: bigint;
  readonly currency: string;
}

export const RECONCILE_REASON = Object.freeze({
  DEPOSIT_PAID_LATE: "Reconciliation: the provider shows this deposit paid after it closed unpaid.",
  DEPOSIT_NOT_PAID: "Reconciliation: the provider shows no successful charge for a credited deposit.",
  DEPOSIT_REVERSED: "Reconciliation: the provider reversed a charge that was credited.",
  DEPOSIT_AMOUNT: "Reconciliation: the provider's amount differs from the credited amount.",
  TRANSFER_PAID_AFTER_REFUND: "Reconciliation: the provider paid out a withdrawal that was refunded to the wallet.",
  TRANSFER_NOT_PAID: "Reconciliation: the provider shows no completed transfer for a confirmed withdrawal.",
  TRANSFER_AMOUNT: "Reconciliation: the provider's transferred amount differs from the withdrawal.",
  TRANSFER_STILL_OPEN: "Reconciliation: the provider still shows a refunded withdrawal in progress.",
});

const PAID_OUT = new Set(["CONFIRMED"]);

/**
 * What a second look at the provider means for a payment we have already closed.
 * Money only moves automatically where the normal settlement path would move it;
 * every other disagreement is flagged for an operator. `waitedOut` is set once the
 * provider has had long enough to finish, so "still in progress" stops being an answer.
 */
export function reconciliationVerdict(payment: ClosedPayment, outcome: ProviderOutcome, waitedOut = false): ReconciliationVerdict {
  const paid = PAID_OUT.has(payment.status);

  if (outcome.kind === "PENDING" || outcome.kind === "PROCESSING") {
    if (!waitedOut) {
      return { kind: "WAIT" };
    }

    // A checkout nobody paid stays "abandoned" at the provider indefinitely; nothing moved.
    if (payment.direction === "DEPOSIT") {
      return paid ? { kind: "FLAG", reason: RECONCILE_REASON.DEPOSIT_NOT_PAID } : { kind: "AGREES" };
    }

    return { kind: "FLAG", reason: paid ? RECONCILE_REASON.TRANSFER_NOT_PAID : RECONCILE_REASON.TRANSFER_STILL_OPEN };
  }

  if (payment.direction === "DEPOSIT") {
    switch (outcome.kind) {
      case "SUCCEEDED":
        if (!paid) {
          return { kind: "FLAG", reason: RECONCILE_REASON.DEPOSIT_PAID_LATE };
        }

        return BigInt(outcome.amount) === payment.amount && outcome.currency.toUpperCase() === payment.currency
          ? { kind: "AGREES" }
          : { kind: "FLAG", reason: RECONCILE_REASON.DEPOSIT_AMOUNT };
      case "REVERSED":
        return paid ? { kind: "FLAG", reason: RECONCILE_REASON.DEPOSIT_REVERSED } : { kind: "AGREES" };
      case "FAILED":
      case "EXPIRED":
      case "NOT_FOUND":
        return paid ? { kind: "FLAG", reason: RECONCILE_REASON.DEPOSIT_NOT_PAID } : { kind: "AGREES" };
    }
  }

  switch (outcome.kind) {
    case "SUCCEEDED":
      if (!paid) {
        return { kind: "FLAG", reason: RECONCILE_REASON.TRANSFER_PAID_AFTER_REFUND };
      }

      return BigInt(outcome.amount) === payment.netAmount ? { kind: "AGREES" } : { kind: "FLAG", reason: RECONCILE_REASON.TRANSFER_AMOUNT };
    case "REVERSED":
      return paid ? { kind: "SETTLE" } : { kind: "AGREES" };
    case "FAILED":
    case "EXPIRED":
    case "NOT_FOUND":
      return paid ? { kind: "FLAG", reason: RECONCILE_REASON.TRANSFER_NOT_PAID } : { kind: "AGREES" };
  }
}
