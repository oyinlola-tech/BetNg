import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  readonly data: T | undefined;
  readonly error: unknown;
  readonly loading: boolean;
  readonly refresh: () => void;
}

/** A polling read. Keeps the last good value while refreshing, so the screen never blanks. */
export function useAsync<T>(
  read: () => Promise<T>,
  deps: readonly unknown[],
  intervalMs?: number,
): AsyncState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(undefined);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const latest = useRef(read);

  latest.current = read;

  useEffect(() => {
    let cancelled = false;

    const run = async (): Promise<void> => {
      try {
        const value = await latest.current();

        if (!cancelled) {
          setData(value);
          setError(undefined);
        }
      } catch (cause) {
        if (!cancelled) setError(cause);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();

    const timer =
      intervalMs === undefined
        ? undefined
        : setInterval(() => void run(), intervalMs);

    return () => {
      cancelled = true;
      if (timer !== undefined) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, intervalMs]);

  const refresh = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  return { data, error, loading, refresh };
}
