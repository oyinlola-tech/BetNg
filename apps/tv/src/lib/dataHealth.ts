import { useSyncExternalStore } from "react";

export interface DataHealth {
  readonly failing: boolean;
  readonly lastSuccessAt: number | undefined;
}

const FAILURES_BEFORE_STALE = 2;

let consecutiveFailures = 0;
let state: DataHealth = { failing: false, lastSuccessAt: undefined };
const listeners = new Set<() => void>();

function publish(next: DataHealth): void {
  if (next.failing === state.failing && next.lastSuccessAt === state.lastSuccessAt) return;

  state = next;
  for (const l of listeners) l();
}

export function reportReadSuccess(now: number = Date.now()): void {
  consecutiveFailures = 0;
  publish({ failing: false, lastSuccessAt: now });
}

export function reportReadFailure(): void {
  consecutiveFailures += 1;
  if (consecutiveFailures >= FAILURES_BEFORE_STALE) publish({ ...state, failing: true });
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
