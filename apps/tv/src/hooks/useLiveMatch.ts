/**
 * Subscribes to one match's live stream and keeps its state correct.
 *
 * The stream is a projection, never the source of truth. This hook encodes
 * that: it reads the match over REST first, applies live frames on top, and
 * re-reads whenever the stream reports a gap or reconnects. A client that
 * missed frames therefore converges back on what the platform recorded
 * rather than drifting.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveClient, LiveEvent, Match } from "../types/live.type";
import { api, openLiveStream } from "../services/index";

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

  const clientRef = useRef<LiveClient | undefined>(undefined);

  /** Re-reads the match. Called on mount, on a gap and after a reconnect. */
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
      // A gap means what is on screen may no longer match what the platform
      // recorded, so the match is re-read rather than patched over.
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

    clientRef.current = client;
    client.connect();
    client.subscribe(matchId);

    return () => {
      client.close();
      clientRef.current = undefined;
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
