/**
 * The settlement service's data-access contracts.
 *
 * A settlement is written once. `recordSettlement` is the no-double-pay guarantee: it inserts on the unique
 * `(bet_id, revision)` key and reports whether this call created the row, so a redelivered or concurrent
 * request finds the settlement that already exists instead of writing a second one.
 */

import type { MatchSettlementKind } from "../constants/index.js";
import type {
  AdminSettlementRecord,
  AdminSettlementStatus,
  BetLegRecord,
  BetRecord,
  MatchSettlementRecord,
  MatchSettlementStatus,
  MatchState,
  NewSettlement,
  SettlementRecord,
} from "../models/index.js";
import type { BetOutcome, FinalScore } from "../utils/index.js";

export interface BeginMatchSettlementResult {
  /** False when the match settlement was already COMPLETED and nothing was changed. */
  readonly started: boolean;
  readonly record: MatchSettlementRecord;
}

export interface FinishMatchSettlement {
  readonly matchId: string;
  readonly status: Exclude<MatchSettlementStatus, "STARTED">;
  readonly betsTotal: number;
  readonly betsSettled: number;
  readonly failureReason: string | null;
}

export interface RecordSettlementResult {
  /** False when the bet already had a settlement; `record` is then the one that exists. */
  readonly created: boolean;
  readonly record: SettlementRecord;
}

export interface SettlementFilter {
  /** Restricts the read to one customer's bets. Absent only for an admin. */
  readonly userId?: string;
  readonly outcome?: BetOutcome;
  readonly matchId?: string;
  readonly limit: number;
}

export interface AdminSettlementFilter {
  readonly status?: AdminSettlementStatus;
  readonly limit: number;
}

export interface SettlementRepository {
  beginMatchSettlement(matchId: string, kind: MatchSettlementKind): Promise<BeginMatchSettlementResult>;
  finishMatchSettlement(input: FinishMatchSettlement): Promise<MatchSettlementRecord>;
  findMatchSettlement(matchId: string): Promise<MatchSettlementRecord | undefined>;

  recordSettlement(settlement: NewSettlement): Promise<RecordSettlementResult>;
  /** Sets `effects_applied_at` once. Returns false when it was already set. */
  stampEffects(settlementId: string): Promise<boolean>;
  findByBetIds(betIds: readonly string[]): Promise<readonly SettlementRecord[]>;
  listUnstamped(limit: number): Promise<readonly SettlementRecord[]>;

  findByBet(betId: string, userId?: string): Promise<SettlementRecord | undefined>;
  list(filter: SettlementFilter): Promise<readonly SettlementRecord[]>;

  listAdmin(filter: AdminSettlementFilter): Promise<readonly AdminSettlementRecord[]>;
  findAdminByBet(betId: string): Promise<AdminSettlementRecord | undefined>;
}

/**
 * Read-only access to the schemas other services own. Settlement reads bets, legs, match state and the
 * authoritative result; it writes none of them.
 */
export interface PlatformReader {
  findMatch(matchId: string): Promise<MatchState | undefined>;
  /** The authoritative result from `simulation.match_results`. */
  findResult(matchId: string): Promise<FinalScore | undefined>;
  /** Every bet with a leg on the match, cancelled bets excluded. */
  listBetsOnMatch(matchId: string): Promise<readonly BetRecord[]>;
  listLegs(betIds: readonly string[]): Promise<readonly BetLegRecord[]>;
  findShopNames(shopIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
}
