/**
 * The peers betting calls, as the placement and ticket paths see them.
 *
 * Each rejects with `PeerRefusedError` when the peer answered with a refusal
 * and `PeerUnavailableError` when the outcome is unknown. They are interfaces
 * so the paths can be exercised against fakes without a network.
 */

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
  /** Kobo, always positive: the procedure names the direction. */
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
  /** Best effort: resolves whether or not the entry was written. */
  recordAudit(entry: AuditEntry): Promise<void>;
}
