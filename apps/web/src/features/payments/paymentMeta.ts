import { TERMINAL_PAYMENT_STATUSES, type PaymentDirection, type PaymentMethod, type PaymentStatus } from "@betng/contracts";

export const PAYMENT_METHODS: readonly PaymentMethod[] = ["CARD", "BANK_TRANSFER", "USSD"];

export const PAYMENT_STATUSES: readonly PaymentStatus[] = ["INITIATED", "PENDING", "PROCESSING", "CONFIRMED", "FAILED", "CANCELLED", "EXPIRED", "REVERSED"];

export const PAYMENT_DIRECTIONS: readonly PaymentDirection[] = ["DEPOSIT", "WITHDRAWAL"];

export const METHOD_META: Readonly<Record<PaymentMethod, { readonly label: string; readonly description: string }>> = {
  CARD: { label: "Card", description: "Pay on the provider's secure card page." },
  BANK_TRANSFER: { label: "Bank transfer", description: "Transfer to a one-time account the platform gives you." },
  USSD: { label: "USSD", description: "Dial a code on your phone to approve the payment." },
};

export const DIRECTION_LABEL: Readonly<Record<PaymentDirection, string>> = { DEPOSIT: "Deposit", WITHDRAWAL: "Withdrawal" };

export function isTerminalPayment(status: PaymentStatus): boolean {
  return TERMINAL_PAYMENT_STATUSES.includes(status);
}

const REFERENCE = /^[A-Za-z0-9_-]{6,64}$/;

/** A payment reference as the platform issues it; anything else in a URL is ignored. */
export function validReference(value: string | null | undefined): string | undefined {
  return typeof value === "string" && REFERENCE.test(value) ? value : undefined;
}

export function readDirection(value: string | null): PaymentDirection {
  return value?.toUpperCase() === "WITHDRAWAL" ? "WITHDRAWAL" : "DEPOSIT";
}

export function paymentPath(reference: string, direction: PaymentDirection): string {
  return direction === "WITHDRAWAL" ? `/payments/${reference}?direction=withdrawal` : `/payments/${reference}`;
}

/** Status checks back off while the payment stays open, so a slow provider is not hammered. */
export const POLL_DELAYS_MS: readonly number[] = [2_000, 3_000, 5_000, 8_000, 13_000, 20_000];

export function pollDelay(checks: number, delays: readonly number[] = POLL_DELAYS_MS): number {
  return delays[Math.min(checks, delays.length - 1)] ?? 20_000;
}

/** The platform masks account numbers; the page shows the last four digits only, whatever it receives. */
export function maskedAccount(masked: string): string {
  const digits = masked.replace(/\D/g, "").slice(-4);

  return digits === "" ? "••••" : `•••• ${digits}`;
}

const IN_FLIGHT_KEY = "betng.payments.inflight";

export interface InFlightPayment {
  readonly reference: string;
  readonly direction: PaymentDirection;
}

/** Only the reference and direction are kept, so a reload or the provider's redirect can resume the status check. */
export function rememberInFlight(payment: InFlightPayment): void {
  try {
    window.sessionStorage.setItem(IN_FLIGHT_KEY, JSON.stringify({ reference: payment.reference, direction: payment.direction }));
  } catch {
    /* storage can be unavailable; resuming then relies on the URL */
  }
}

export function readInFlight(): InFlightPayment | undefined {
  try {
    const raw = window.sessionStorage.getItem(IN_FLIGHT_KEY);

    if (raw === null) return undefined;

    const parsed = JSON.parse(raw) as { reference?: unknown; direction?: unknown };
    const reference = typeof parsed.reference === "string" ? validReference(parsed.reference) : undefined;

    return reference === undefined ? undefined : { reference, direction: readDirection(typeof parsed.direction === "string" ? parsed.direction : null) };
  } catch {
    return undefined;
  }
}

export function forgetInFlight(reference?: string): void {
  try {
    if (reference === undefined || readInFlight()?.reference === reference) window.sessionStorage.removeItem(IN_FLIGHT_KEY);
  } catch {
    /* nothing to clear */
  }
}
