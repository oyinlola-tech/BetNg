import type { DepositInitiation, PaymentMethod, PaymentRecord, PaymentStatus } from "@betng/contracts";

export type DepositPhase = "idle" | "validating" | "initiating" | "redirecting" | "processing" | "confirmed" | "failed" | "cancelled" | "expired";

/** One logical deposit. Its idempotency key survives retries of the same amount and method; a new attempt gets a new key. */
export interface DepositAttempt {
  readonly key: string;
  readonly amount: number;
  readonly method: PaymentMethod;
}

export interface DepositState {
  readonly phase: DepositPhase;
  readonly attempt?: DepositAttempt | undefined;
  readonly payment?: PaymentRecord | undefined;
  readonly instructions?: DepositInitiation["instructions"];
  readonly checkoutUrl?: string | undefined;
  readonly expiresAt?: string | undefined;
  readonly error?: unknown;
  /** The platform named a checkout host outside the allowlist, so the page refused to leave. */
  readonly blockedRedirect?: boolean;
}

export type DepositEvent =
  | { readonly type: "SUBMIT" }
  | { readonly type: "INVALID" }
  | { readonly type: "INITIATE"; readonly attempt: DepositAttempt }
  | { readonly type: "INITIATED"; readonly result: DepositInitiation; readonly redirectAllowed: boolean }
  | { readonly type: "INITIATE_FAILED"; readonly error: unknown }
  | { readonly type: "STATUS"; readonly payment: PaymentRecord }
  | { readonly type: "RESET" };

export const INITIAL_DEPOSIT: DepositState = { phase: "idle" };

export function phaseForStatus(status: PaymentStatus): DepositPhase {
  switch (status) {
    case "CONFIRMED":
      return "confirmed";
    case "FAILED":
    case "REVERSED":
      return "failed";
    case "CANCELLED":
      return "cancelled";
    case "EXPIRED":
      return "expired";
    default:
      return "processing";
  }
}

export function isFinishedPhase(phase: DepositPhase): boolean {
  return phase === "confirmed" || phase === "failed" || phase === "cancelled" || phase === "expired";
}

/** The attempt to send: the unfinished one when nothing about it changed, otherwise a fresh one. */
export function nextAttempt(state: DepositState, amount: number, method: PaymentMethod, newKey: () => string): DepositAttempt {
  const current = state.attempt;

  if (current !== undefined && state.payment === undefined && current.amount === amount && current.method === method) return current;

  return { key: newKey(), amount, method };
}

export function depositReducer(state: DepositState, event: DepositEvent): DepositState {
  switch (event.type) {
    case "SUBMIT":
      return state.phase === "idle" ? { ...state, phase: "validating", error: undefined } : state;
    case "INVALID":
      return state.phase === "validating" ? { ...state, phase: "idle" } : state;
    case "INITIATE":
      return state.phase === "validating" || state.phase === "idle" ? { phase: "initiating", attempt: event.attempt } : state;
    case "INITIATE_FAILED":
      return state.phase === "initiating" ? { phase: "idle", attempt: state.attempt, error: event.error } : state;
    case "INITIATED": {
      if (state.phase !== "initiating") return state;

      const { payment, checkoutUrl, instructions, expiresAt } = event.result;
      const base: DepositState = { phase: "processing", attempt: state.attempt, payment, instructions, expiresAt };
      const settled = phaseForStatus(payment.status);

      if (settled !== "processing") return { ...base, phase: settled };
      if (checkoutUrl === undefined) return base;

      return event.redirectAllowed ? { ...base, phase: "redirecting", checkoutUrl } : { ...base, phase: "failed", blockedRedirect: true };
    }
    case "STATUS":
      if ((state.phase !== "processing" && state.phase !== "redirecting") || state.payment?.reference !== event.payment.reference) return state;

      return { ...state, phase: phaseForStatus(event.payment.status), payment: event.payment };
    case "RESET":
      return INITIAL_DEPOSIT;
  }
}
