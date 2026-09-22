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
  readonly started: boolean;
  readonly record: MatchSettlementRecord;
}

export interface FinishMatchSettlement {
  readonly matchId: string;
  readonly status: Exclude<MatchSettlementStatus, "STARTED">;
  readonly betsTotal: number;
  readonly betsSettled: number;
  readonly failureReason: string | null;
  /** Raises `attempts` to at least this, so automatic callers stop and an operator retry is needed. */
  readonly parkAfterAttempts?: number;
}

export interface RecordSettlementResult {
  readonly created: boolean;
  readonly record: SettlementRecord;
}

export interface SettlementFilter {
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
  stampEffects(settlementId: string): Promise<boolean>;
  findByBetIds(betIds: readonly string[]): Promise<readonly SettlementRecord[]>;
  listUnstamped(limit: number, excludeIds?: readonly string[]): Promise<readonly SettlementRecord[]>;

  findByBet(betId: string, userId?: string): Promise<SettlementRecord | undefined>;
  list(filter: SettlementFilter): Promise<readonly SettlementRecord[]>;

  listAdmin(filter: AdminSettlementFilter): Promise<readonly AdminSettlementRecord[]>;
  findAdminByBet(betId: string): Promise<AdminSettlementRecord | undefined>;
}

export interface PlatformReader {
  findMatch(matchId: string): Promise<MatchState | undefined>;
  findResult(matchId: string): Promise<FinalScore | undefined>;
  listBetsOnMatch(matchId: string): Promise<readonly BetRecord[]>;
  listLegs(betIds: readonly string[]): Promise<readonly BetLegRecord[]>;
  findShopNames(shopIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
}
