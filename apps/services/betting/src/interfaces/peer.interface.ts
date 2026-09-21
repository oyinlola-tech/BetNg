import type { RiskDecision, RiskEvaluateRequest } from "@betng/contracts";

export interface RiskPeer {
  evaluate(
    request: RiskEvaluateRequest,
    requestId: string,
  ): Promise<RiskDecision>;
}

export type WalletOwnerType = "CUSTOMER" | "SHOP";

export type WalletMovementType =
  | "BET_STAKE"
  | "BET_REFUND"
  | "TICKET_SALE"
  | "TICKET_PAYOUT"
  | "TICKET_CANCEL";

export interface WalletMovement {
  readonly ownerType: WalletOwnerType;
  readonly ownerId: string;
  // Always positive; the procedure (debit/credit) names the direction.
  readonly amount: number;
  readonly type: WalletMovementType;
  readonly idempotencyKey: string;
  readonly reference?: string;
  readonly note?: string;
  readonly actorId?: string;
}

export interface WalletPeer {
  debit(movement: WalletMovement, requestId: string): Promise<void>;
  credit(movement: WalletMovement, requestId: string): Promise<void>;
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
  readonly severity?: "INFO" | "WARNING" | "CRITICAL";
  readonly requestId: string;
}

export interface IdentityPeer {
  verifyCashierPin(
    cashierId: string,
    pin: string,
    requestId: string,
  ): Promise<boolean>;
  // Best effort: never rejects.
  recordAudit(entry: AuditEntry): Promise<void>;
}
