import { useEffect, useState } from "react";

import { api } from "../services";
import type { Match } from "../types";

export interface MatchesState {
  readonly matches: readonly Match[];
  readonly loading: boolean;
  readonly error: string | undefined;
}

export function useMatches(): MatchesState {
  const [matches, setMatches] = useState<readonly Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await api.listMatches();
        if (!cancelled) setMatches(result);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { matches, loading, error };
}
