import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

export interface AsyncState<T> {
  readonly data: T | undefined;
  readonly error: unknown;
  readonly loading: boolean;
  readonly refreshing: boolean;
  readonly refresh: () => Promise<void>;
}

/**
 * Keeps the last value on screen while it re-reads (on deps change, on the
 * interval, and when the app returns to the foreground). Only the newest read
 * may land, and a timer tick never starts a second read while one is running.
 */
export function useAsync<T>(
  read: () => Promise<T>,
  deps: readonly unknown[],
  intervalMs?: number,
): AsyncState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(read);
  const generation = useRef(0);
  const inFlight = useRef<Promise<void> | undefined>(undefined);

  latest.current = read;

  const run = useCallback((manual = false): Promise<void> => {
    generation.current += 1;

    const ticket = generation.current;

    if (manual) setRefreshing(true);

    const pending = (async () => {
      try {
        const value = await latest.current();

        if (ticket === generation.current) {
          setData(value);
          setError(undefined);
        }
      } catch (cause) {
        if (ticket === generation.current) setError(cause);
      } finally {
        if (ticket === generation.current) {
          setLoading(false);
          if (manual) setRefreshing(false);
        }
      }
    })();

    inFlight.current = pending;
    void pending.finally(() => {
      if (inFlight.current === pending) inFlight.current = undefined;
    });

    return pending;
  }, []);

  const background = useCallback((): void => {
    if (inFlight.current === undefined) void run();
  }, [run]);

  useEffect(() => {
    inFlight.current = undefined;
    setLoading(true);
    setRefreshing(false);
    void run();

    const timer = intervalMs === undefined ? undefined : setInterval(background, intervalMs);
    let state = AppState.currentState;
    const subscription = AppState.addEventListener("change", (next) => {
      if (state !== "active" && next === "active") background();
      state = next;
    });

    return () => {
      generation.current += 1;
      if (timer !== undefined) clearInterval(timer);
      subscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, intervalMs, run, background]);

  const refresh = useCallback(() => run(true), [run]);

  return { data, error, loading, refreshing, refresh };
}
