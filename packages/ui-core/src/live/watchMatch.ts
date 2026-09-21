import type { MatchId } from "@betng/contracts";
import type { BetNgDataSource } from "../dataSource.type.js";
import { resolvePhase } from "../phase.js";
import type {
  ClockPeriod,
  ConnectionState,
  MatchClockView,
  MatchEventView,
  MatchView,
} from "../types/index.js";

export interface LiveMatchSnapshot {
  readonly match: MatchView | undefined;
  readonly connection: ConnectionState;
  readonly resyncing: boolean;
  readonly error: string | undefined;
  readonly lastEvent: MatchEventView | undefined;
  readonly syncedAt: number | undefined;
}

export interface LiveMatchController {
  readonly getSnapshot: () => LiveMatchSnapshot;
  readonly subscribe: (listener: () => void) => () => void;
  readonly stop: () => void;
  readonly resync: () => void;
}

const PERIOD_AFTER: Readonly<Partial<Record<MatchEventView["kind"], ClockPeriod>>> = {
  KICK_OFF: "FIRST_HALF",
  HALF_TIME: "HALF_TIME",
  SECOND_HALF: "SECOND_HALF",
  FULL_TIME: "FULL_TIME",
};

function clockAfter(
  current: MatchClockView | undefined,
  event: MatchEventView,
): MatchClockView {
  return {
    ...current,
    period: PERIOD_AFTER[event.kind] ?? current?.period ?? "FIRST_HALF",
    minute: event.minute,
    asOf: event.occurredAt === "" ? new Date().toISOString() : event.occurredAt,
  };
}

export function watchMatch(
  source: BetNgDataSource,
  matchId: MatchId,
): LiveMatchController {
  let snapshot: LiveMatchSnapshot = {
    match: undefined,
    connection: source.getConnectionState(),
    resyncing: false,
    error: undefined,
    lastEvent: undefined,
    syncedAt: undefined,
  };

  const listeners = new Set<() => void>();
  let stopped = false;
  let resyncSerial = 0;
  let streamSequence = 0;

  function publish(next: Partial<LiveMatchSnapshot>): void {
    snapshot = { ...snapshot, ...next };
    for (const listener of listeners) listener();
  }

  async function resync(): Promise<void> {
    const serial = ++resyncSerial;

    publish({ resyncing: true });

    try {
      const match = await source.getMatch(matchId);

      // A later resync superseded this one; its answer is newer.
      if (stopped || serial !== resyncSerial) return;

      publish({
        match,
        resyncing: false,
        error: undefined,
        syncedAt: Date.now(),
      });
    } catch (cause) {
      if (stopped || serial !== resyncSerial) return;

      publish({
        resyncing: false,
        error:
          cause instanceof Error
            ? cause.message
            : "The match could not be read.",
      });
    }
  }

  function applyEvent(event: MatchEventView): void {
    const current = snapshot.match;

    // No snapshot yet: the read in flight will include this event.
    if (current === undefined) return;
    if (event.sequence <= streamSequence) return;

    const gap = streamSequence > 0 && event.sequence > streamSequence + 1;

    streamSequence = event.sequence;

    if (gap) {
      void resync();

      return;
    }

    const known = current.events.some(
      (e) =>
        e.id === event.id ||
        (e.kind === event.kind &&
          e.minute === event.minute &&
          e.side === event.side &&
          e.score.home === event.score.home &&
          e.score.away === event.score.away),
    );

    if (known) return;

    const status =
      event.kind === "FULL_TIME"
        ? "COMPLETED"
        : event.kind === "KICK_OFF"
          ? "IN_PLAY"
          : current.status;
    const clock = clockAfter(current.clock, event);

    publish({
      match: {
        ...current,
        events: [...current.events, event],
        score: event.score,
        status,
        clock,
        phase: resolvePhase(status, {
          lifecycle: current.lifecycle,
          period: clock.period,
        }),
        updatedAt: clock.asOf,
      },
      lastEvent: event,
    });

    // Full time is when statistics are finalised and the result is recorded,
    // so the authoritative copy is read once more rather than trusted from
    // the stream.
    if (event.kind === "FULL_TIME") void resync();
  }

  let wasDown = false;

  const subscription = source.subscribeMatch(matchId, {
    onEvent: applyEvent,
    onSignal: () => {
      void resync();
    },
    onConnection: (state) => {
      const recovered = wasDown && state === "CONNECTED";

      wasDown = state === "RECONNECTING" || state === "OFFLINE";
      publish({ connection: state });

      if (recovered) void resync();
    },
  });

  void resync();

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    stop: () => {
      stopped = true;
      subscription.unsubscribe();
      listeners.clear();
    },
    resync: () => {
      void resync();
    },
  };
}
