/**
 * Reads the matches the lobby lists.
 */

import { useEffect, useState } from "react";

import { api } from "../services";
import type { Match } from "../types";

/** What the lobby needs to render. */
export interface MatchesState {
  readonly matches: readonly Match[];
  readonly loading: boolean;
  readonly error: string | undefined;
}

/**
 * Loads the platform's matches once.
 *
 * @returns The matches, and whether they are still loading.
 */
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
