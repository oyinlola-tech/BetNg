import type { SettlementRecord } from "../models/index.js";
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

/** The owner type is fixed: settlement credits customers and nobody else; there is no operator wallet. */
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

export interface CustomerNotification {
  readonly customerId: string;
  readonly kind: "BET_SETTLED";
  readonly title: string;
  readonly body: string;
  readonly data: {
    readonly betId: string;
    readonly matchId?: string;
    readonly outcome: BetOutcome;
    readonly payout: number;
  };
  readonly dedupeKey: string;
}

export interface NotifyResult {
  readonly id: string;
  readonly duplicate: boolean;
}

export interface IdentityPeer {
  recordAudit(entry: AuditEntry): Promise<{ readonly id: string }>;
  notify(notification: CustomerNotification, requestId: string): Promise<NotifyResult>;
}

export type BetSignal = "BET_SETTLED";

export interface EventPeer {
  publishSignal(channel: string, type: BetSignal, requestId: string, betId: string): Promise<void>;
}

export interface SettlementNotifier {
  /** Best effort: returns at once, never throws, and a failed delivery is only logged. */
  settled(settlement: SettlementRecord, requestId: string): void;
  idle(): Promise<void>;
}

export interface AuditActor {
  readonly actorId: string;
  readonly actorRole: string;
  readonly requestId: string;
}

export interface AuditRecorder {
  recordBestEffort(entry: AuditEntry): Promise<void>;
  /** Configuration entries: a failure throws and the change is abandoned. */
  recordRequired(entry: AuditEntry): Promise<void>;
}
