/**
 * Persistence shapes. Money is `bigint` kobo from the database to the edge of the service; it becomes a JSON
 * integer only in a DTO mapper.
 */

import type { MatchSettlementKind } from "../constants/index.js";
import type { BetOutcome, LegOutcome } from "../utils/index.js";

export type BetChannel = "ONLINE" | "SHOP";

export type MatchSettlementStatus = "STARTED" | "COMPLETED" | "FAILED";

export interface SettledLegRecord {
  readonly selectionId: string;
  readonly matchId: string;
  readonly outcome: LegOutcome;
  readonly result: string | null;
}

export interface SettlementRecord {
  readonly id: string;
  readonly betId: string;
  readonly revision: number;
  readonly outcome: BetOutcome;
  readonly stake: bigint;
  readonly payout: bigint;
  readonly channel: BetChannel;
  readonly userId: string | null;
  readonly shopId: string | null;
  readonly cashierId: string | null;
  readonly periodId: string;
  readonly effectsAppliedAt: Date | null;
  readonly settledAt: Date;
  readonly legs: readonly SettledLegRecord[];
}

export interface NewSettlement {
  readonly betId: string;
  readonly outcome: BetOutcome;
  readonly stake: bigint;
  readonly payout: bigint;
  readonly channel: BetChannel;
  readonly userId: string | null;
  readonly shopId: string | null;
  readonly cashierId: string | null;
  readonly legs: readonly SettledLegRecord[];
}

export interface MatchSettlementRecord {
  readonly matchId: string;
  readonly kind: MatchSettlementKind;
  readonly status: MatchSettlementStatus;
  readonly betsTotal: number;
  readonly betsSettled: number;
  readonly attempts: number;
  readonly failureReason: string | null;
  readonly startedAt: Date;
  readonly completedAt: Date | null;
}

export interface MatchState {
  readonly id: string;
  readonly status: string;
  readonly lifecycle: string;
}

/** A bet as settlement needs it, read from `betting.bets`. */
export interface BetRecord {
  readonly id: string;
  readonly userId: string | null;
  readonly channel: BetChannel;
  readonly shopId: string | null;
  readonly cashierId: string | null;
  readonly stake: bigint;
  readonly status: string;
}

/** A leg with the state of the match it is on, read across `betting`, `match`, `simulation` and `settlement`. */
export interface BetLegRecord {
  readonly betId: string;
  readonly selectionId: string;
  readonly matchId: string;
  readonly marketType: string;
  readonly selectionCode: string;
  readonly line: string | null;
  /** The odds accepted with the bet, as text. Settlement never reads a current price. */
  readonly odds: string;
  readonly matchStatus: string | null;
  readonly matchLifecycle: string | null;
  readonly homeGoals: number | null;
  readonly awayGoals: number | null;
  readonly matchSettlementKind: string | null;
}

export type AdminSettlementStatus = "PENDING" | "COMPLETED" | "FAILED" | "VOIDED";

/** One bet on a match that settlement has been asked to settle, as the admin console lists it. */
export interface AdminSettlementRecord {
  readonly betId: string;
  readonly settlementId: string | null;
  readonly ticketCode: string | null;
  readonly channel: BetChannel;
  readonly ownerName: string | null;
  readonly ownerId: string | null;
  readonly matchLabel: string;
  readonly result: string;
  readonly stake: bigint;
  readonly payout: bigint;
  readonly status: AdminSettlementStatus;
  readonly error: string | null;
  readonly timestamp: Date;
  /** Matches among the bet's legs whose settlement is FAILED; what a retry re-runs. */
  readonly failedMatchIds: readonly string[];
}
