/**
 * The peers settlement calls over RPC (`docs/architecture.md` §6), behind interfaces so tests inject fakes.
 *
 * Every call is idempotent on the callee's side: `betting.applySettlement` by bet, `wallet.credit` by
 * idempotency key. That is what lets the retry loop re-apply effects without paying twice.
 */

import type { BetOutcome, LegOutcome } from "../utils/index.js";

export interface ApplySettlementRequest {
  readonly betId: string;
  readonly outcome: BetOutcome;
  readonly payout: number;
  readonly legs: readonly {
    readonly selectionId: string;
    readonly outcome: LegOutcome;
    readonly result: string | null;
  }[];
  readonly settledAt: string;
}

export interface ApplySettlementResult {
  readonly betId: string;
  readonly status: string;
}

export interface BettingPeer {
  applySettlement(request: ApplySettlementRequest, requestId: string): Promise<ApplySettlementResult>;
}

/**
 * A credit to a customer wallet. The owner type is fixed: settlement pays customers and nobody else. There
 * is no operator or admin wallet, and a negative operator result is never moved anywhere.
 */
export interface WalletCreditRequest {
  readonly ownerType: "CUSTOMER";
  readonly ownerId: string;
  readonly amount: number;
  readonly type: "BET_PAYOUT" | "BET_REFUND";
  readonly idempotencyKey: string;
  readonly reference: string;
  readonly note?: string;
}

export interface WalletCreditResult {
  readonly duplicate: boolean;
}

export interface WalletPeer {
  credit(request: WalletCreditRequest, requestId: string): Promise<WalletCreditResult>;
}

export interface AuditEntry {
  readonly actorId: string;
  readonly actorRole: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly before?: Readonly<Record<string, unknown>>;
  readonly after?: Readonly<Record<string, unknown>>;
  readonly reason?: string;
  readonly severity?: "INFO" | "NOTICE" | "WARNING" | "CRITICAL";
  readonly requestId: string;
}

export interface IdentityPeer {
  recordAudit(entry: AuditEntry): Promise<{ readonly id: string }>;
}

/** Who an operation is attributed to in the audit trail. */
export interface AuditActor {
  readonly actorId: string;
  readonly actorRole: string;
  readonly requestId: string;
}

export interface AuditRecorder {
  recordBestEffort(entry: AuditEntry): Promise<void>;
  /** Configuration entries: a failure throws `AuditUnavailableError`, and the change is abandoned. */
  recordRequired(entry: AuditEntry): Promise<void>;
}
