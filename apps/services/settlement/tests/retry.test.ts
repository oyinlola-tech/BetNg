import { describe, expect, it } from "vitest";
import type { Logger } from "@betng/service-kit";
import { isPermanentFailure, SettlementDataError } from "../src/errors/index.js";
import type {
  SettlementNotifier,
  SettlementRepository,
  WalletCreditRequest,
} from "../src/interfaces/index.js";
import type { MatchSettlementRecord, SettlementRecord } from "../src/models/index.js";
import { EffectsApplier } from "../src/services/settlement/effects.applier.js";
import { MatchSettler } from "../src/services/settlement/match.settler.js";
import type { MatchSettlerDependencies } from "../src/services/settlement/match.settler.js";
import {
  effectsBackoffMs,
  RetryEffectsCommand,
  RetryEffectsHandler,
} from "../src/services/settlement/commands/index.js";
import { mapWithConcurrency } from "../src/utils/index.js";

interface LogLine {
  readonly level: string;
  readonly message: string;
  readonly fields: Record<string, unknown>;
}

function recordingLogger(): { logger: Logger; lines: LogLine[] } {
  const lines: LogLine[] = [];
  const at =
    (level: string) =>
    (message: string, fields: Record<string, unknown> = {}): void => {
      lines.push({ level, message, fields });
    };

  return {
    lines,
    logger: {
      trace: at("trace"),
      debug: at("debug"),
      info: at("info"),
      warn: at("warn"),
      error: at("error"),
      fatal: at("fatal"),
    } as unknown as Logger,
  };
}

function settlementRecord(overrides: Partial<SettlementRecord> = {}): SettlementRecord {
  const betId = crypto.randomUUID();

  return {
    id: crypto.randomUUID(),
    betId,
    revision: 1,
    outcome: "WON",
    stake: 1_000n,
    payout: 2_500n,
    channel: "ONLINE",
    userId: crypto.randomUUID(),
    shopId: null,
    cashierId: null,
    periodId: "SESSION-20260922-0001",
    effectsAppliedAt: null,
    settledAt: new Date("2026-09-22T10:00:00Z"),
    legs: [{ selectionId: crypto.randomUUID(), matchId: crypto.randomUUID(), outcome: "WON", result: "2-1" }],
    ...overrides,
  };
}

/** Dedupes on the idempotency key exactly as the wallet does: a repeated key moves nothing. */
class DedupingWallet {
  public readonly calls: WalletCreditRequest[] = [];
  public readonly balances = new Map<string, number>();
  public failing: Error | undefined;
  private readonly seen = new Set<string>();

  public readonly peer = {
    credit: async (request: WalletCreditRequest) => {
      this.calls.push(request);

      if (this.failing !== undefined) {
        throw this.failing;
      }

      await new Promise((resolve) => setTimeout(resolve, 5));

      if (this.seen.has(request.idempotencyKey)) {
        return { duplicate: true };
      }

      this.seen.add(request.idempotencyKey);
      this.balances.set(request.ownerId, (this.balances.get(request.ownerId) ?? 0) + request.amount);

      return { duplicate: false };
    },
  };
}

function applierWith(options: {
  wallet: DedupingWallet;
  stamp: (settlementId: string) => Promise<boolean>;
  bettingCalls?: string[];
}): EffectsApplier {
  const notifier: SettlementNotifier = { settled: () => undefined, idle: async () => undefined };

  return new EffectsApplier({
    settlements: { stampEffects: options.stamp } as unknown as SettlementRepository,
    betting: {
      applySettlement: async (request) => {
        options.bettingCalls?.push(request.betId);

        return { betId: request.betId, status: request.outcome };
      },
    },
    wallet: options.wallet.peer,
    notifier,
    logger: recordingLogger().logger,
  });
}

describe("mapWithConcurrency", () => {
  it("keeps the input order", async () => {
    const results = await mapWithConcurrency([30, 10, 20], 2, async (ms) => {
      await new Promise((resolve) => setTimeout(resolve, ms));

      return ms * 2;
    });

    expect(results).toEqual([60, 20, 40]);
  });

  it("stops starting items after a rejection, waits for those in flight, and rethrows the first error", async () => {
    const started: number[] = [];
    const finished: number[] = [];

    const run = mapWithConcurrency([0, 1, 2, 3, 4, 5, 6, 7], 3, async (item) => {
      started.push(item);

      if (item === 1) {
        throw new Error("item 1 failed");
      }

      if (item === 4) {
        throw new Error("item 4 failed");
      }

      await new Promise((resolve) => setTimeout(resolve, 30));
      finished.push(item);

      return item;
    });

    await expect(run).rejects.toThrow("item 1 failed");
    expect(started).toEqual([0, 1, 2]);
    expect(finished.sort()).toEqual([0, 2]);

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(started).toEqual([0, 1, 2]);
  });

  it("does not hang on an empty list and refuses a limit below one", async () => {
    await expect(mapWithConcurrency([], 4, async () => 1)).resolves.toEqual([]);
    await expect(mapWithConcurrency([1], 0, async () => 1)).rejects.toThrow(RangeError);
  });
});

describe("failure classification and backoff", () => {
  it("treats code and data faults as permanent and everything else as retryable", () => {
    expect(isPermanentFailure(new TypeError("x is undefined"))).toBe(true);
    expect(isPermanentFailure(new RangeError("bad"))).toBe(true);
    expect(isPermanentFailure(new SettlementDataError("corrupt line"))).toBe(true);
    expect(isPermanentFailure(new Error("wallet is down"))).toBe(false);
    expect(isPermanentFailure("string")).toBe(false);
  });

  it("retries twice at once, then doubles up to the cap; a permanent fault waits the cap", () => {
    expect(effectsBackoffMs(1, false)).toBe(0);
    expect(effectsBackoffMs(2, false)).toBe(0);
    expect(effectsBackoffMs(3, false)).toBe(5_000);
    expect(effectsBackoffMs(4, false)).toBe(10_000);
    expect(effectsBackoffMs(40, false)).toBe(300_000);
    expect(effectsBackoffMs(1, true)).toBe(300_000);
  });
});

describe("settlement effects", () => {
  it("recovers a crash between the wallet credit and the stamp without paying twice", async () => {
    const wallet = new DedupingWallet();
    const settlement = settlementRecord();
    let stampFailures = 1;
    const stamped: string[] = [];

    const applier = applierWith({
      wallet,
      stamp: async (id) => {
        if (stampFailures > 0) {
          stampFailures -= 1;
          throw new Error("process died before the stamp");
        }

        stamped.push(id);

        return true;
      },
    });

    await expect(applier.apply(settlement, "first")).rejects.toThrow("process died");
    expect(wallet.balances.get(settlement.userId ?? "")).toBe(2_500);

    await applier.apply(settlement, "retry");

    expect(stamped).toEqual([settlement.id]);
    expect(wallet.calls.map((call) => call.idempotencyKey)).toEqual([
      `settlement-payout:${settlement.betId}`,
      `settlement-payout:${settlement.betId}`,
    ]);
    expect(wallet.balances.get(settlement.userId ?? "")).toBe(2_500);
  });

  it("runs one application when the same settlement is applied concurrently", async () => {
    const wallet = new DedupingWallet();
    const settlement = settlementRecord();
    const bettingCalls: string[] = [];

    const applier = applierWith({ wallet, stamp: async () => true, bettingCalls });

    await Promise.all([
      applier.apply(settlement, "a"),
      applier.apply(settlement, "b"),
      applier.apply(settlement, "c"),
    ]);

    expect(bettingCalls).toEqual([settlement.betId]);
    expect(wallet.calls).toHaveLength(1);
    expect(wallet.balances.get(settlement.userId ?? "")).toBe(2_500);
  });

  it("refuses to pay an online settlement without a customer as a permanent fault", async () => {
    const wallet = new DedupingWallet();
    const applier = applierWith({ wallet, stamp: async () => true });

    const failure = await applier.apply(settlementRecord({ userId: null }), "x").catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(SettlementDataError);
    expect(isPermanentFailure(failure)).toBe(true);
    expect(wallet.calls).toEqual([]);
  });
});

describe("the effects retry loop", () => {
  function loopWith(settlements: SettlementRecord[], wallet: DedupingWallet, clock: { now: number }) {
    const excluded: (readonly string[])[] = [];
    const { logger, lines } = recordingLogger();
    const stampedIds = new Set<string>();

    const repository = {
      listUnstamped: async (_limit: number, excludeIds: readonly string[] = []) => {
        excluded.push(excludeIds);

        return settlements.filter((item) => !stampedIds.has(item.id) && !excludeIds.includes(item.id));
      },
      stampEffects: async (id: string) => {
        stampedIds.add(id);

        return true;
      },
      findMatchSettlement: async () => undefined,
    } as unknown as SettlementRepository;

    const effects = new EffectsApplier({
      settlements: repository,
      betting: { applySettlement: async (request) => ({ betId: request.betId, status: request.outcome }) },
      wallet: wallet.peer,
      notifier: { settled: () => undefined, idle: async () => undefined },
      logger,
    });

    const handler = new RetryEffectsHandler(
      repository,
      effects,
      {} as MatchSettler,
      logger,
      () => clock.now,
    );

    return {
      excluded,
      lines,
      stampedIds,
      pass: async () => handler.execute(new RetryEffectsCommand("test")),
    };
  }

  it("backs off a failing payout, alerts once it keeps failing, and still pays it exactly once", async () => {
    const wallet = new DedupingWallet();
    const clock = { now: 1_000_000 };
    const settlement = settlementRecord();
    const loop = loopWith([settlement], wallet, clock);

    wallet.failing = new Error("wallet is down");

    for (let pass = 0; pass < 3; pass += 1) {
      await loop.pass();
    }

    expect(wallet.calls).toHaveLength(3);
    expect((await loop.pass()).backingOff).toBe(1);
    expect(wallet.calls).toHaveLength(3);

    clock.now += 5_000;
    await loop.pass();
    clock.now += 10_000;
    await loop.pass();

    expect(wallet.calls).toHaveLength(5);
    expect(loop.lines.filter((line) => line.fields["event"] === "settlement.effects_stuck")).toHaveLength(1);
    expect(loop.lines.find((line) => line.fields["event"] === "settlement.effects_stuck")?.fields).toMatchObject({
      alert: true,
      failures: 5,
      betId: settlement.betId,
    });

    wallet.failing = undefined;
    clock.now += 20_000;

    expect(await loop.pass()).toMatchObject({ attempted: 1, applied: 1 });
    expect(loop.stampedIds.has(settlement.id)).toBe(true);
    expect(wallet.balances.get(settlement.userId ?? "")).toBe(2_500);
    expect(await loop.pass()).toMatchObject({ attempted: 0, backingOff: 0 });
  });

  it("parks a permanent fault at the cap with an alert and keeps paying the others", async () => {
    const wallet = new DedupingWallet();
    const clock = { now: 5_000_000 };
    const broken = settlementRecord({ userId: null });
    const healthy = settlementRecord();
    const loop = loopWith([broken, healthy], wallet, clock);

    expect(await loop.pass()).toMatchObject({ attempted: 2, applied: 1 });
    expect(loop.lines.find((line) => line.fields["event"] === "settlement.effects_stuck")?.fields).toMatchObject({
      alert: true,
      permanent: true,
      settlementId: broken.id,
    });

    clock.now += 299_000;
    await loop.pass();

    expect(loop.excluded.at(-1)).toEqual([broken.id]);

    clock.now += 1_000;
    await loop.pass();

    expect(loop.excluded.at(-1)).toEqual([]);
  });
});

describe("automatic settle attempts", () => {
  function settlerWith(record: MatchSettlementRecord | undefined): { settler: MatchSettler; begun: string[] } {
    const begun: string[] = [];
    const { logger } = recordingLogger();

    const settlements = {
      findMatchSettlement: async () => record,
      beginMatchSettlement: async (matchId: string) => {
        begun.push(matchId);

        return { started: false, record: { ...(record as MatchSettlementRecord), status: "COMPLETED" } };
      },
    } as unknown as SettlementRepository;

    const dependencies = {
      settlements,
      platform: { findMatch: async (id: string) => ({ id, status: "COMPLETED", lifecycle: "MATCH_FINISHED" }) },
      effects: {} as EffectsApplier,
      audit: { recordBestEffort: async () => undefined },
      logger,
    } as unknown as MatchSettlerDependencies;

    return { settler: new MatchSettler(dependencies), begun };
  }

  const failed = (attempts: number): MatchSettlementRecord => ({
    matchId: "m",
    kind: "RESULT",
    status: "FAILED",
    betsTotal: 1,
    betsSettled: 0,
    attempts,
    failureReason: "1 of 1 bets could not be settled and paid; 1 need an operator retry.",
    startedAt: new Date(),
    completedAt: null,
  });

  const actor = { actorId: "system", actorRole: "SYSTEM", requestId: "r" };

  it("stops automatic callers at the limit and still lets an operator retry", async () => {
    const parked = settlerWith(failed(10));

    await expect(
      parked.settler.settle({ matchId: "m", kind: "RESULT", actor, attemptLimit: 10 }),
    ).rejects.toMatchObject({ code: "SETTLEMENT_FAILED", statusCode: 502 });
    expect(parked.begun).toEqual([]);

    await parked.settler.settle({ matchId: "m", kind: "RESULT", actor: { ...actor, actorRole: "ADMIN" } });
    expect(parked.begun).toEqual(["m"]);
  });

  it("lets automatic callers through below the limit", async () => {
    const below = settlerWith(failed(9));

    await below.settler.settle({ matchId: "m", kind: "RESULT", actor, attemptLimit: 10 });
    expect(below.begun).toEqual(["m"]);
  });
});
