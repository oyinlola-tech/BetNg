import type { MatchId } from "@betng/contracts";
import type { BetNgDataSource } from "../dataSource.type.js";
import { derivePhase } from "../phase.js";
import type {
  ConnectionState,
  MatchEventView,
  MatchView,
} from "../types/index.js";

export interface LiveMatchSnapshot {
  readonly match: MatchView | undefined;
  readonly connection: ConnectionState;
  readonly resyncing: boolean;
  readonly error: string | undefined;
  readonly lastEvent: MatchEventView | undefined;
}

export interface LiveMatchController {
  readonly getSnapshot: () => LiveMatchSnapshot;
  readonly subscribe: (listener: () => void) => () => void;
  readonly stop: () => void;
  readonly tick: (now?: number) => void;
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
  };

  const listeners = new Set<() => void>();
  let stopped = false;
  let resyncSerial = 0;

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

      publish({ match, resyncing: false, error: undefined });
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

    const last = current.events.at(-1)?.sequence ?? 0;

    if (event.sequence <= last) return;

    if (event.sequence > last + 1) {
      void resync();
      return;
    }

    const phase = derivePhase(current.status, current.kickoffAt, Date.now());

    publish({
      match: {
        ...current,
        events: [...current.events, event],
        score: event.score,
        phase,
        status:
          event.kind === "FULL_TIME"
            ? "COMPLETED"
            : event.kind === "KICK_OFF"
              ? "IN_PLAY"
              : current.status,
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
    tick: (now = Date.now()) => {
      const current = snapshot.match;

      if (current === undefined) return;

      const phase = derivePhase(current.status, current.kickoffAt, now);

      if (phase !== current.phase) {
        publish({ match: { ...current, phase } });
      }
    },
  };
}
