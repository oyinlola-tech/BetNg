import type { WalletMovement } from "./peer.interface.js";

export type StakeReturnDirection = "debit" | "credit";

export type StakeReturnResolution = "RETURNED" | "BET_EXISTS";

export interface PendingStakeReturn {
  readonly betId: string;
  readonly direction: StakeReturnDirection;
  readonly movement: WalletMovement;
  readonly requestId: string;
  readonly attempts: number;
}

export interface StakeReturnRepository {
  // Idempotent on the bet id: recording the same return twice keeps the first row.
  record(entry: PendingStakeReturn, nextAttemptAt: Date): Promise<void>;
  // Due rows are leased to one worker (SKIP LOCKED) until `leaseUntil`, so instances do not race on one row.
  claimDue(now: Date, leaseUntil: Date, limit: number): Promise<readonly PendingStakeReturn[]>;
  defer(betId: string, error: string, nextAttemptAt: Date): Promise<void>;
  resolve(betId: string, resolution: StakeReturnResolution, now: Date): Promise<void>;
}
