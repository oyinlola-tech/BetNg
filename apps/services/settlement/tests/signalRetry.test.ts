import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "@betng/service-kit";
import { withBetSignals } from "../src/clients/index.js";
import type { EventPeer, SettlementNotifier } from "../src/interfaces/index.js";
import type { SettlementRecord } from "../src/models/index.js";

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

const quietNotifier: SettlementNotifier = { settled: () => undefined, idle: async () => undefined };

function onlineSettlement(): SettlementRecord {
  return {
    id: randomUUID(),
    betId: randomUUID(),
    revision: 1,
    channel: "ONLINE",
    userId: randomUUID(),
    shopId: null,
    cashierId: null,
    periodId: "P",
    outcome: "WON",
    stake: 1_000n,
    payout: 2_000n,
    effectsAppliedAt: null,
    settledAt: new Date(),
    legs: [],
  };
}

/** Fails the first `failures` calls on every channel, then publishes. */
function flakyEvent(failures: number): { event: EventPeer; attempts: Map<string, number>; published: string[] } {
  const attempts = new Map<string, number>();
  const published: string[] = [];

  return {
    attempts,
    published,
    event: {
      publishSignal: async (channel) => {
        const count = (attempts.get(channel) ?? 0) + 1;

        attempts.set(channel, count);
        if (count <= failures) throw new Error("event service unreachable");
        published.push(channel);
      },
    },
  };
}

describe("BET_SETTLED signal retry", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries a failed publish with backoff and stays quiet once it lands", async () => {
    const { logger, lines } = recordingLogger();
    const { event, attempts, published } = flakyEvent(2);
    const settlement = onlineSettlement();
    const notifier = withBetSignals(quietNotifier, event, logger, { delaysMs: [1, 1, 1] });

    notifier.settled(settlement, "req-1");
    await vi.waitFor(() => {
      expect(published).toHaveLength(2);
    });

    expect([...attempts.values()]).toEqual([3, 3]);
    expect(published).toEqual([`user:${settlement.userId}`, `bets:${settlement.userId}`]);
    expect(lines.filter((line) => line.level === "warn")).toEqual([]);
  });

  it("waits out the backoff schedule before each retry", async () => {
    vi.useFakeTimers();

    const { logger } = recordingLogger();
    const { event, attempts } = flakyEvent(Number.POSITIVE_INFINITY);
    const settlement = onlineSettlement();
    const notifier = withBetSignals(quietNotifier, event, logger, { random: () => 0.5 });
    const channel = `user:${settlement.userId}`;

    notifier.settled(settlement, "req-5");
    await vi.advanceTimersByTimeAsync(0);
    expect(attempts.get(channel)).toBe(1);

    await vi.advanceTimersByTimeAsync(249);
    expect(attempts.get(channel)).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(attempts.get(channel)).toBe(2);

    await vi.advanceTimersByTimeAsync(999);
    expect(attempts.get(channel)).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(attempts.get(channel)).toBe(3);

    await vi.advanceTimersByTimeAsync(4_000);
    expect(attempts.get(channel)).toBe(4);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(attempts.get(channel)).toBe(4);
  });

  it("gives up after the last attempt with one warning per channel", async () => {
    const { logger, lines } = recordingLogger();
    const { event, attempts, published } = flakyEvent(Number.POSITIVE_INFINITY);
    const settlement = onlineSettlement();
    const notifier = withBetSignals(quietNotifier, event, logger, { delaysMs: [1, 1] });

    notifier.settled(settlement, "req-2");
    await notifier.idle();

    expect([...attempts.values()]).toEqual([3, 3]);
    expect(published).toEqual([]);

    const warnings = lines.filter((line) => line.level === "warn");

    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toMatchObject({
      message: "Realtime signal was not published",
      fields: {
        requestId: "req-2",
        event: "signal_not_published",
        betId: settlement.betId,
        settlementId: settlement.id,
        attempts: 3,
      },
    });
  });

  it("returns from settled at once even though every publish rejects", async () => {
    const { logger } = recordingLogger();
    let calls = 0;
    const event: EventPeer = {
      publishSignal: async () => {
        calls += 1;
        throw new Error("event service unreachable");
      },
    };
    const notifier = withBetSignals(quietNotifier, event, logger, { delaysMs: [60_000] });

    expect(notifier.settled(onlineSettlement(), "req-3")).toBeUndefined();
    expect(calls).toBe(2);

    const started = Date.now();

    await notifier.idle();

    expect(calls).toBe(4);
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it("waits for the wrapped notifier and for signals still in flight", async () => {
    const { logger } = recordingLogger();
    const { event, published } = flakyEvent(1);
    let innerIdle = false;
    const inner: SettlementNotifier = {
      settled: () => undefined,
      idle: async () => {
        innerIdle = true;
      },
    };
    const notifier = withBetSignals(inner, event, logger, { delaysMs: [1] });

    notifier.settled(onlineSettlement(), "req-4");
    await notifier.idle();

    expect(published).toHaveLength(2);
    expect(innerIdle).toBe(true);
  });
});
