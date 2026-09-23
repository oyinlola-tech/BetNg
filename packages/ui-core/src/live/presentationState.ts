import { isInPlay } from "../phase.js";
import type {
  ConnectionState,
  MatchPhase,
  MatchView,
  Score,
  TeamView,
} from "../types/index.js";
import {
  routeMatchEvents,
  type PresentationEvent,
} from "./matchEventRouter.js";
import { PITCH_CENTRE, type PitchPoint } from "./pitchGeometry.js";

/*
 * What a live surface draws. Derived from the authoritative match on every
 * read — never written to, never the source of a fact. Deleting this file
 * would cost the drawing, not the match.
 */

export type LiveConnectionStatus =
  | "CONNECTING"
  | "CONNECTED"
  | "RECONNECTING"
  | "OFFLINE"
  | "FAILED"
  | "STALE";

export interface PlayerMarkerView {
  readonly id: string;
  readonly side: "HOME" | "AWAY";
  readonly name: string;
  readonly shirtNumber: number | undefined;
  readonly position: PitchPoint;
  readonly card: "YELLOW" | "RED" | undefined;
  /** Sent off, as the platform reported it — never inferred from a card animation. */
  readonly sentOff: boolean;
  readonly substituted: boolean;
}

export interface BallView {
  readonly position: PitchPoint;
  readonly visible: boolean;
  /** The event that put the ball here, for a renderer that animates the trip. */
  readonly since: PresentationEvent | undefined;
}

export interface LiveMatchPresentationState {
  readonly matchId: string;
  readonly home: TeamView;
  readonly away: TeamView;
  readonly score: Score;
  readonly minute: number | undefined;
  readonly phase: MatchPhase;
  readonly players: readonly PlayerMarkerView[];
  readonly ball: BallView;
  readonly events: readonly PresentationEvent[];
  readonly lastEvent: PresentationEvent | undefined;
  readonly connection: LiveConnectionStatus;
  readonly syncedAt: number | undefined;
}

/** Live data older than this is called stale rather than shown as current. */
export const STALE_AFTER_MS = 20_000;

export function connectionStatus(
  connection: ConnectionState,
  syncedAt: number | undefined,
  now: number,
): LiveConnectionStatus {
  if (connection !== "CONNECTED") return connection;
  if (syncedAt !== undefined && now - syncedAt > STALE_AFTER_MS) return "STALE";

  return "CONNECTED";
}

/*
 * The ball sits where the most recent event that fixes a position put it. Events
 * that say nothing about location leave it alone, so it never jumps to the
 * centre because of a foul.
 */
function ballFrom(
  events: readonly PresentationEvent[],
  phase: MatchPhase,
): BallView {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];

    if (event?.to !== undefined) {
      return { position: event.to, visible: isInPlay(phase), since: event };
    }
  }

  return {
    position: PITCH_CENTRE,
    visible: isInPlay(phase),
    since: undefined,
  };
}

export interface PresentationStateInput {
  readonly match: MatchView;
  readonly connection: ConnectionState;
  readonly syncedAt: number | undefined;
  readonly now: number;
  /** Positions the platform reported. Nothing is drawn for a player it did not send. */
  readonly players?: readonly PlayerMarkerView[] | undefined;
  readonly minute?: number | undefined;
}

export function toPresentationState(
  input: PresentationStateInput,
): LiveMatchPresentationState {
  const { match } = input;
  const events = routeMatchEvents(match.events, match);

  return {
    matchId: match.id,
    home: match.home,
    away: match.away,
    score: match.score,
    minute: input.minute ?? match.clock?.minute,
    phase: match.phase,
    players: input.players ?? [],
    ball: ballFrom(events, match.phase),
    events,
    lastEvent: events[events.length - 1],
    connection: connectionStatus(input.connection, input.syncedAt, input.now),
    syncedAt: input.syncedAt,
  };
}
