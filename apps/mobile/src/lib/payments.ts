import { TERMINAL_PAYMENT_STATUSES, type PaymentRecord, type PaymentStatus } from "@betng/contracts";
import type { StateTone } from "@betng/design-tokens";

export interface PaymentStatusView {
  readonly label: string;
  readonly tone: StateTone;
  readonly settled: boolean;
}

const VIEWS: Readonly<Record<PaymentStatus, Omit<PaymentStatusView, "settled">>> = {
  INITIATED: { label: "Awaiting payment", tone: "pending" },
  PENDING: { label: "Pending", tone: "pending" },
  PROCESSING: { label: "Processing", tone: "pending" },
  CONFIRMED: { label: "Confirmed", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "void" },
  EXPIRED: { label: "Expired", tone: "void" },
  REVERSED: { label: "Reversed", tone: "warning" },
};

export function paymentStatusView(status: PaymentStatus): PaymentStatusView {
  return { ...VIEWS[status], settled: TERMINAL_PAYMENT_STATUSES.includes(status) };
}

/** Only a status the platform reported as CONFIRMED is ever described as done. */
export function paymentSummary(payment: PaymentRecord): string {
  const kind = payment.direction === "DEPOSIT" ? "Deposit" : "Withdrawal";

  switch (payment.status) {
    case "CONFIRMED":
      return `${kind} confirmed by the platform.`;
    case "FAILED":
      return payment.failureReason ?? `${kind} failed. No money moved.`;
    case "CANCELLED":
    case "EXPIRED":
      return `${kind} ${payment.status === "EXPIRED" ? "expired" : "was cancelled"}. No money moved.`;
    case "REVERSED":
      return `${kind} was reversed.`;
    default:
      return `${kind} is not confirmed yet. Your balance changes only when the platform confirms it.`;
  }
}
