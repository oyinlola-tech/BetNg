/**
 * Reads the matches the lobby lists.
 *
 * A plain fetch-on-mount: the lobby is a list of scheduled and in-play
 * matches, and it does not need the live stream. Only a match being watched
 * does, which is what `useLiveMatch` is for.
 */

import { useEffect, useState } from "react";
import type { Match } from "../types/index";
import { api } from "../services/index";

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
        // The component may have unmounted while the request was in flight;
        // setting state then is a leak and a React warning.
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
