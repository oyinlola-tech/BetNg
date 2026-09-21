import type { SessionLike, SessionStore } from "./session.js";

export type SessionMonitorPhase = "SIGNED_OUT" | "ACTIVE" | "EXPIRING" | "EXPIRED";

export interface SessionMonitorState {
  readonly phase: SessionMonitorPhase;
  /** Milliseconds left on the platform-issued expiry; 0 once it has passed. */
  readonly remainingMs: number;
}

export interface SessionMonitorOptions {
  readonly warnBeforeMs?: number;
  readonly tickMs?: number;
  readonly now?: () => number;
  /** Asks the platform to extend the session; false or a throw means it could not. */
  readonly refresh?: () => Promise<unknown>;
}

export interface SessionMonitor {
  readonly state: () => SessionMonitorState;
  readonly subscribe: (listener: () => void) => () => void;
  /** Resolves true only when the platform extended the session. */
  readonly refresh: () => Promise<boolean>;
  readonly canRefresh: boolean;
  readonly dispose: () => void;
}

/** Derives the warning before a session runs out from the platform's `expiresAt`; the store itself expires the session when it passes. */
export function createSessionMonitor<S extends SessionLike>(store: SessionStore<S>, options: SessionMonitorOptions = {}): SessionMonitor {
  const warnBeforeMs = options.warnBeforeMs ?? 2 * 60_000;
  const tickMs = options.tickMs ?? 1_000;
  const now = options.now ?? Date.now;
  const listeners = new Set<() => void>();
  let state: SessionMonitorState = { phase: "SIGNED_OUT", remainingMs: 0 };
  let timer: ReturnType<typeof setInterval> | undefined;

  const compute = (): SessionMonitorState => {
    const snapshot = store.snapshot();

    if (snapshot.status === "EXPIRED") return { phase: "EXPIRED", remainingMs: 0 };
    if (snapshot.status !== "AUTHENTICATED" || snapshot.session === undefined) return { phase: "SIGNED_OUT", remainingMs: 0 };

    const remainingMs = Math.max(0, Date.parse(snapshot.session.expiresAt) - now());

    return { phase: remainingMs <= warnBeforeMs ? "EXPIRING" : "ACTIVE", remainingMs };
  };

  const update = (): void => {
    const next = compute();
    const changed = next.phase !== state.phase || (next.phase === "EXPIRING" && Math.floor(next.remainingMs / 1000) !== Math.floor(state.remainingMs / 1000));

    state = next;
    if (changed) for (const listener of listeners) listener();
  };

  const schedule = (): void => {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    if (store.snapshot().status === "AUTHENTICATED") timer = setInterval(update, tickMs);
  };

  const unsubscribe = store.subscribe(() => {
    update();
    schedule();
  });

  update();
  schedule();

  return {
    state: () => state,
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    canRefresh: options.refresh !== undefined,
    refresh: async () => {
      if (options.refresh === undefined || store.snapshot().status !== "AUTHENTICATED") return false;

      const before = store.snapshot().session?.expiresAt;

      try {
        await options.refresh();
      } catch {
        return false;
      }

      update();

      return store.snapshot().session?.expiresAt !== before;
    },
    dispose: () => {
      unsubscribe();
      if (timer !== undefined) clearInterval(timer);
      listeners.clear();
    },
  };
}
