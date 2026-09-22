import type { Bank, PaymentMethod } from "@betng/contracts";
import type { ProviderId } from "../constants/payments.constant.js";

export type ProviderOutcome =
  | { readonly kind: "SUCCEEDED"; readonly amount: number; readonly currency: string }
  | { readonly kind: "FAILED" }
  | { readonly kind: "EXPIRED" }
  | { readonly kind: "REVERSED" }
  | { readonly kind: "PROCESSING" }
  | { readonly kind: "PENDING" }
  | { readonly kind: "NOT_FOUND" };

export interface DepositInstructions {
  readonly title: string;
  readonly lines: readonly string[];
}

export interface InitiateDepositInput {
  readonly reference: string;
  readonly amount: number;
  readonly method: PaymentMethod;
  readonly email: string;
  readonly callbackUrl: string;
}

export interface InitiateDepositResult {
  readonly providerReference?: string;
  readonly checkoutUrl?: string;
  readonly instructions?: DepositInstructions;
}

export interface ProviderCheck {
  readonly reference: string;
  readonly providerReference: string | undefined;
  readonly amount: number;
  /** 1 for the first check of this payment, then 2, 3, … */
  readonly attempt: number;
}

export interface TransferInput {
  readonly reference: string;
  readonly amount: number;
  readonly bankCode: string;
  readonly accountNumber: string;
  readonly accountName: string;
  readonly recipientCode: string | undefined;
  readonly narration: string;
}

export interface TransferResult {
  readonly providerReference: string | undefined;
  readonly recipientCode: string | undefined;
  readonly outcome: ProviderOutcome;
}

export interface WebhookEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly subject: "DEPOSIT" | "TRANSFER" | "IGNORED";
  readonly reference: string | undefined;
  readonly amount: number | undefined;
  readonly currency: string | undefined;
}

export type HeaderReader = (name: string) => string | undefined;

export interface PaymentProvider {
  readonly id: ProviderId;
  /** False for an adapter that exists but cannot talk to its provider (Bachs). */
  readonly configured: boolean;
  initiateDeposit(input: InitiateDepositInput): Promise<InitiateDepositResult>;
  verifyDeposit(check: ProviderCheck): Promise<ProviderOutcome>;
  listBanks(): Promise<readonly Bank[]>;
  /** Undefined when the provider says no such account exists at that bank. */
  resolveAccount(bankCode: string, accountNumber: string): Promise<{ readonly accountName: string } | undefined>;
  transfer(input: TransferInput): Promise<TransferResult>;
  transferStatus(check: ProviderCheck): Promise<ProviderOutcome>;
  /** Verifies the signature over the raw bytes before anything is parsed; throws WebhookRejectedError otherwise. */
  parseWebhook(rawBody: Uint8Array, header: HeaderReader): WebhookEvent;
  probe(): Promise<void>;
}
