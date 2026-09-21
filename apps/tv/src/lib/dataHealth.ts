import { useSyncExternalStore } from "react";
import type { ConnectionState } from "@betng/ui-core";

export interface DataHealth {
  readonly failing: boolean;
  readonly lastSuccessAt: number | undefined;
  readonly realtimeDownSince: number | undefined;
}

export type Freshness = "current" | "reconnecting" | "delayed" | "stale";

const FAILURES_BEFORE_STALE = 2;

/** Past this, what is on screen is labelled out of date rather than merely delayed. */
export const STALE_AFTER_MS = 20_000;

let consecutiveFailures = 0;
let state: DataHealth = { failing: false, lastSuccessAt: undefined, realtimeDownSince: undefined };
const listeners = new Set<() => void>();

function publish(next: DataHealth): void {
  if (
    next.failing === state.failing &&
    next.lastSuccessAt === state.lastSuccessAt &&
    next.realtimeDownSince === state.realtimeDownSince
  )
    return;

  state = next;
  for (const l of listeners) l();
}

export function isRealtimeDown(connection: ConnectionState): boolean {
  return connection === "RECONNECTING" || connection === "OFFLINE" || connection === "FAILED";
}

export function reportReadSuccess(now: number = Date.now()): void {
  consecutiveFailures = 0;
  publish({ ...state, failing: false, lastSuccessAt: now });
}

export function reportReadFailure(): void {
  consecutiveFailures += 1;
  if (consecutiveFailures >= FAILURES_BEFORE_STALE) publish({ ...state, failing: true });
}

export function reportConnection(connection: ConnectionState, now: number = Date.now()): void {
  if (!isRealtimeDown(connection)) publish({ ...state, realtimeDownSince: undefined });
  else if (state.realtimeDownSince === undefined) publish({ ...state, realtimeDownSince: now });
}

export function resetDataHealth(): void {
  consecutiveFailures = 0;
  publish({ failing: false, lastSuccessAt: undefined, realtimeDownSince: undefined });
}

/** Polled reads failing long enough makes the picture stale; so does the live stream being down, for screens fed by it. */
export function freshness(health: DataHealth, now: number, fedByRealtime = false): Freshness {
  const readsStale =
    health.failing && (health.lastSuccessAt === undefined || now - health.lastSuccessAt >= STALE_AFTER_MS);
  const realtimeStale =
    fedByRealtime && health.realtimeDownSince !== undefined && now - health.realtimeDownSince >= STALE_AFTER_MS;

  if (readsStale || realtimeStale) return "stale";
  if (health.failing) return "delayed";
  if (health.realtimeDownSince !== undefined) return "reconnecting";

  return "current";
}

/** Live-stream data stops being extrapolated once it is stale: a clock must not run on unseen. */
export function liveClockNow(realtimeDownSince: number | undefined, now: number): number {
  return realtimeDownSince === undefined ? now : Math.min(now, realtimeDownSince + STALE_AFTER_MS);
}

/** The same for polled data: while reads fail, a clock stops once the last good read is stale. */
export function polledClockNow(health: DataHealth, now: number): number {
  return health.failing && health.lastSuccessAt !== undefined ? Math.min(now, health.lastSuccessAt + STALE_AFTER_MS) : now;
}

export function useDataHealth(): DataHealth {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);

      return () => {
        listeners.delete(onChange);
      };
    },
    () => state,
    () => state,
  );
}
