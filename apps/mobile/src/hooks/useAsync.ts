import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  readonly data: T | undefined;
  readonly error: unknown;
  readonly loading: boolean;
  readonly refreshing: boolean;
  readonly refresh: () => Promise<void>;
}

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
  const alive = useRef(true);

  latest.current = read;

  const run = useCallback(async (manual = false): Promise<void> => {
    if (manual) setRefreshing(true);

    try {
      const value = await latest.current();

      if (alive.current) {
        setData(value);
        setError(undefined);
      }
    } catch (cause) {
      if (alive.current) setError(cause);
    } finally {
      if (alive.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    setLoading(true);
    void run();

    const timer =
      intervalMs === undefined
        ? undefined
        : setInterval(() => void run(), intervalMs);

    return () => {
      alive.current = false;
      if (timer !== undefined) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, intervalMs, run]);

  const refresh = useCallback(() => run(true), [run]);

  return { data, error, loading, refreshing, refresh };
}
