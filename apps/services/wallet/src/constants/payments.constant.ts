import type { PaymentStatus } from "@betng/contracts";

export const PAYMENT_ERROR = Object.freeze({
  PAYMENT_FAILED: "PAYMENT_FAILED",
  PAYMENT_PROVIDER_UNAVAILABLE: "PAYMENT_PROVIDER_UNAVAILABLE",
  LIMIT_EXCEEDED: "LIMIT_EXCEEDED",
  SELF_EXCLUDED: "SELF_EXCLUDED",
  ACCOUNT_RESTRICTED: "ACCOUNT_RESTRICTED",
  KYC_REQUIRED: "KYC_REQUIRED",
});

export const PROVIDER_IDS = Object.freeze(["PAYSTACK", "FLUTTERWAVE", "BACHS", "SANDBOX"] as const);

export type ProviderId = (typeof PROVIDER_IDS)[number];

export const PAYMENT_TRANSITIONS: Readonly<Record<PaymentStatus, readonly PaymentStatus[]>> = Object.freeze({
  INITIATED: ["PENDING", "PROCESSING", "CONFIRMED", "FAILED", "CANCELLED", "EXPIRED"],
  PENDING: ["PROCESSING", "CONFIRMED", "FAILED", "CANCELLED", "EXPIRED"],
  PROCESSING: ["CONFIRMED", "FAILED", "CANCELLED", "EXPIRED"],
  CONFIRMED: ["REVERSED"],
  FAILED: [],
  CANCELLED: [],
  EXPIRED: [],
  REVERSED: [],
});

export const IN_FLIGHT_STATUSES: readonly PaymentStatus[] = ["INITIATED", "PENDING", "PROCESSING"];

export const PAYMENT_PERMISSION = Object.freeze({
  READ: "payments:read",
  WRITE: "payments:write",
});

export const SHOP_PERMISSION = Object.freeze({
  SHIFTS_OPERATE: "shifts:operate",
  CASH_MOVE: "cash:move",
  CASH_TRANSFER: "cash:transfer",
  REPORTS_READ: "reports:read",
});

export const IDENTITY_PROCEDURE = Object.freeze({
  LIMITS_CHECK: "limits.check",
  KYC_STATUS: "kyc.status",
  NOTIFY: "identity.notify",
  VERIFY_CASHIER_PIN: "identity.verifyCashierPin",
  RECORD_AUDIT: "identity.recordAudit",
});

export const LEDGER_KEY = Object.freeze({
  deposit: (paymentId: string) => `deposit:${paymentId}`,
  withdrawal: (paymentId: string) => `withdrawal:${paymentId}`,
  withdrawalReversal: (paymentId: string) => `withdrawal-reversal:${paymentId}`,
});

export const SAFE_REASON = Object.freeze({
  PROVIDER_UNAVAILABLE: "The payment provider is unavailable. Try again shortly.",
  PROVIDER_DECLINED: "The payment provider declined the payment.",
  DEPOSIT_FAILED: "The payment was not completed.",
  DEPOSIT_EXPIRED: "The payment window closed before it was completed.",
  AMOUNT_MISMATCH: "The amount received did not match; the payment is under review.",
  LATE_SUCCESS: "The provider reported success after the payment had closed.",
  TRANSFER_FAILED: "The bank transfer did not go through; the amount is back in your wallet.",
  TRANSFER_REVERSED: "The bank returned the transfer; the amount is back in your wallet.",
  REVIEW_REJECTED: "The withdrawal was not approved; the amount is back in your wallet.",
});

export const AUDIT_ACTION = Object.freeze({
  WITHDRAWAL_APPROVED: "withdrawal_approved",
  WITHDRAWAL_REJECTED: "withdrawal_rejected",
});

export const STATEMENT = Object.freeze({
  MAX_RANGE_DAYS: 366,
  SYNC_RANGE_DAYS: 31,
  MAX_ROWS: 50_000,
  DOWNLOAD_TTL_SECONDS: 300,
  RETENTION_MS: 24 * 60 * 60 * 1000,
  MAX_ATTEMPTS: 3,
});

export const VERIFICATION_TTL_MS = 10 * 60 * 1000;

export const QUOTE_TTL_MS = 5 * 60 * 1000;

export const BANKS_CACHE_TTL_MS = 60 * 60 * 1000;
