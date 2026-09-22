import type { Logger } from "@betng/service-kit";
import { STAKE_RETURN } from "../../constants/index.js";
import type {
  BetRepository,
  PendingStakeReturn,
  StakeReturnRepository,
  WalletPeer,
} from "../../interfaces/index.js";

export interface StakeReturnerDependencies {
  readonly returns: StakeReturnRepository;
  readonly bets: Pick<BetRepository, "findBet">;
  readonly wallet: WalletPeer;
  readonly logger: Logger;
  readonly now: () => Date;
}

export type StakeReturnOutcome = "RETURNED" | "BET_EXISTS" | "PENDING";

export interface StakeReturnPass {
  readonly attempted: number;
  readonly returned: number;
  readonly pending: number;
}

type Attempt =
  | { readonly kind: "RETURNED" | "BET_EXISTS" }
  | { readonly kind: "FAILED"; readonly reason: string };

function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

export function stakeReturnBackoffMs(attempts: number): number {
  const exponent = Math.max(0, Math.min(attempts, 16));

  return Math.min(STAKE_RETURN.backoffMaxMs, STAKE_RETURN.backoffBaseMs * 2 ** exponent);
}

// The bet is looked up before any money moves: an insert that reported failure but committed owes nothing back.
export class StakeReturner {
  private readonly deps: StakeReturnerDependencies;

  // Returns the database would not even record; kept until it can, and logged so nothing is lost silently.
  private readonly unrecorded = new Map<string, PendingStakeReturn>();

  public constructor(dependencies: StakeReturnerDependencies) {
    this.deps = dependencies;
  }

  public get unrecordedCount(): number {
    return this.unrecorded.size;
  }

  public async returnStake(entry: PendingStakeReturn): Promise<StakeReturnOutcome> {
    const recorded = await this.record(entry);
    const attempt = await this.attempt(entry);

    if (attempt.kind !== "FAILED") {
      if (recorded) {
        await this.resolve(entry, attempt.kind);
      }

      return attempt.kind;
    }

    if (recorded) {
      await this.defer(entry, attempt.reason);
    } else {
      this.unrecorded.set(entry.betId, entry);
    }

    this.deps.logger.error("Stake could not be returned yet; it is queued for retry", {
      requestId: entry.requestId,
      betId: entry.betId,
      event: recorded ? "stake_return_pending" : "stake_return_unrecorded",
      alert: !recorded,
      idempotencyKey: entry.movement.idempotencyKey,
      ownerType: entry.movement.ownerType,
      ownerId: entry.movement.ownerId,
      amount: entry.movement.amount,
      reason: attempt.reason,
    });

    return "PENDING";
  }

  public async drain(): Promise<StakeReturnPass> {
    for (const entry of [...this.unrecorded.values()]) {
      if (await this.record(entry)) {
        this.unrecorded.delete(entry.betId);
      }
    }

    const now = this.deps.now();
    const due = await this.deps.returns.claimDue(
      now,
      new Date(now.getTime() + STAKE_RETURN.leaseMs),
      STAKE_RETURN.batchSize,
    );

    let returned = 0;

    for (const entry of due) {
      const attempt = await this.attempt(entry);

      if (attempt.kind !== "FAILED") {
        await this.resolve(entry, attempt.kind);
        returned += 1;
        continue;
      }

      await this.defer(entry, attempt.reason);

      if (entry.attempts + 1 >= STAKE_RETURN.alertAfterAttempts) {
        this.deps.logger.error("Stake return keeps failing", {
          requestId: entry.requestId,
          betId: entry.betId,
          event: "stake_return_stuck",
          alert: true,
          attempts: entry.attempts + 1,
          idempotencyKey: entry.movement.idempotencyKey,
          ownerType: entry.movement.ownerType,
          ownerId: entry.movement.ownerId,
          amount: entry.movement.amount,
          reason: attempt.reason,
        });
      }
    }

    return {
      attempted: due.length,
      returned,
      pending: due.length - returned + this.unrecorded.size,
    };
  }

  private async attempt(entry: PendingStakeReturn): Promise<Attempt> {
    try {
      if ((await this.deps.bets.findBet(entry.betId)) !== undefined) {
        this.deps.logger.warn("Bet was written after all; its stake stays taken", {
          requestId: entry.requestId,
          betId: entry.betId,
          event: "stake_return_not_owed",
        });

        return { kind: "BET_EXISTS" };
      }
    } catch (error) {
      return { kind: "FAILED", reason: `bet lookup failed (${describe(error)})` };
    }

    try {
      await this.deps.wallet[entry.direction](entry.movement, entry.requestId);
    } catch (error) {
      return { kind: "FAILED", reason: `wallet did not return the stake (${describe(error)})` };
    }

    this.deps.logger.warn("Stake returned", {
      requestId: entry.requestId,
      betId: entry.betId,
      event: "stake_returned",
    });

    return { kind: "RETURNED" };
  }

  private async record(entry: PendingStakeReturn): Promise<boolean> {
    try {
      await this.deps.returns.record(entry, this.deps.now());

      return true;
    } catch (error) {
      this.deps.logger.error("Stake return could not be recorded", {
        requestId: entry.requestId,
        betId: entry.betId,
        event: "stake_return_record_failed",
        idempotencyKey: entry.movement.idempotencyKey,
        error: describe(error),
      });

      return false;
    }
  }

  private async defer(entry: PendingStakeReturn, reason: string): Promise<void> {
    const next = new Date(this.deps.now().getTime() + stakeReturnBackoffMs(entry.attempts + 1));

    try {
      await this.deps.returns.defer(entry.betId, reason, next);
    } catch (error) {
      this.deps.logger.error("Stake return retry could not be scheduled; the lease retries it", {
        requestId: entry.requestId,
        betId: entry.betId,
        event: "stake_return_defer_failed",
        error: describe(error),
      });
    }
  }

  // A row left unresolved is retried; the wallet's idempotency key makes the repeat move nothing.
  private async resolve(
    entry: PendingStakeReturn,
    resolution: "RETURNED" | "BET_EXISTS",
  ): Promise<void> {
    try {
      await this.deps.returns.resolve(entry.betId, resolution, this.deps.now());
    } catch (error) {
      this.deps.logger.error("Stake return could not be marked resolved", {
        requestId: entry.requestId,
        betId: entry.betId,
        event: "stake_return_resolve_failed",
        error: describe(error),
      });
    }
  }
}
