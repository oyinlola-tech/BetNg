/**
 * Subscribes to one match's live stream and keeps its state correct.
 *
 * The same contract as the web and TV hooks: read over REST, apply live
 * frames, re-read whenever the stream reports a gap. The stream is a
 * projection, never the source of truth.
 *
 * Mobile adds one concern the others do not have — the operating system
 * suspends the app when it is backgrounded, so a returning user is almost
 * always behind. The SDK's reconnect reports that as a desync, and this
 * hook re-reads rather than showing a stale score.
 */

import { useCallback, useEffect, useState } from "react";

import { api, openLiveStream } from "../services";
import type { LiveEvent, Match } from "../types";

export interface LiveMatchState {
  readonly match: Match | undefined;
  readonly events: readonly LiveEvent[];
  readonly score: { readonly home: number; readonly away: number };
  readonly connected: boolean;
  readonly error: string | undefined;
}

const NO_SCORE = { home: 0, away: 0 } as const;

export function useLiveMatch(matchId: string | undefined): LiveMatchState {
  const [match, setMatch] = useState<Match | undefined>(undefined);
  const [events, setEvents] = useState<readonly LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const resynchronise = useCallback(async (id: string): Promise<void> => {
    try {
      setMatch(await api.getMatch(id));
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  useEffect(() => {
    if (matchId === undefined) {
      setMatch(undefined);
      setEvents([]);
      return;
    }

    void resynchronise(matchId);

    const client = openLiveStream({
      onEvent: (event) => {
        setEvents((current) => [...current, event]);
      },
      onDesync: (desyncedId) => {
        void resynchronise(desyncedId);
      },
      onOpen: () => {
        setConnected(true);
      },
      onClose: () => {
        setConnected(false);
      },
      onError: (code, message) => {
        setError(`${code}: ${message}`);
      },
    });

    client.connect();
    client.subscribe(matchId);

    return () => {
      client.close();
    };
  }, [matchId, resynchronise]);

  const latest = events.at(-1);

  return {
    match,
    events,
    score: latest?.score ?? match?.score ?? NO_SCORE,
    connected,
    error,
  };
}
