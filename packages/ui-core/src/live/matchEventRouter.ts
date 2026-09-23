import type {
  MatchEventKind,
  MatchEventView,
  MatchSide,
  MatchView,
  Score,
} from "../types/index.js";
import {
  attackingGoal,
  cornerFlag,
  PITCH_CENTRE,
  penaltySpot,
  readPoint,
  type PitchPoint,
} from "./pitchGeometry.js";

/*
 * The router is the one place a platform match event becomes something a
 * surface can draw. Components never read a raw event: they read the
 * presentation event this produces, so the pitch, the timeline, the commentary
 * panel and the overlay all describe the same moment the same way.
 *
 * It normalises, it never invents. Every fact on a presentation event comes
 * from the platform; what the router adds is presentation — a headline, a
 * severity, an animation priority, and the ball position the laws of the game
 * put the ball in after a set piece.
 */

export type EventSeverity = "major" | "medium" | "minor";

/** Scheduling priority for the animation queue. Not a ranking of sporting importance. */
export type AnimationPriority = number;

export type AnimationKind =
  | "NONE"
  | "BALL_MOVE"
  | "PASS"
  | "DRIBBLE"
  | "SHOT"
  | "GOAL"
  | "CARD"
  | "SUBSTITUTION"
  | "VAR"
  | "PERIOD";

export interface PresentationEvent {
  readonly id: string;
  readonly sequence: number;
  readonly kind: MatchEventKind;
  readonly minute: number;
  readonly side: MatchSide | undefined;
  readonly teamName: string | undefined;
  readonly teamCode: string | undefined;
  readonly player: string | undefined;
  readonly secondaryPlayer: string | undefined;
  readonly score: Score;
  readonly headline: string;
  readonly description: string;
  readonly severity: EventSeverity;
  readonly priority: AnimationPriority;
  readonly animation: AnimationKind;
  /** Where the ball starts, when the platform said so. */
  readonly from: PitchPoint | undefined;
  /** Where the ball ends: from the platform, else where the laws put it. */
  readonly to: PitchPoint | undefined;
  readonly occurredAt: string;
  /** Screen readers announce these; ordinary play is not interrupted. */
  readonly announce: boolean;
}

const HEADLINES: Readonly<Record<MatchEventKind, string>> = {
  KICK_OFF: "Kick-off",
  GOAL: "Goal",
  OWN_GOAL: "Own goal",
  PENALTY_GOAL: "Penalty scored",
  PENALTY_MISSED: "Penalty missed",
  VAR: "VAR review",
  OFFSIDE: "Offside",
  FOUL: "Foul",
  FREE_KICK: "Free kick",
  YELLOW_CARD: "Yellow card",
  RED_CARD: "Red card",
  SUBSTITUTION: "Substitution",
  CORNER: "Corner",
  SHOT: "Shot",
  HALF_TIME: "Half time",
  SECOND_HALF: "Second half",
  FULL_TIME: "Full time",
};

const SEVERITY: Readonly<Record<MatchEventKind, EventSeverity>> = {
  GOAL: "major",
  OWN_GOAL: "major",
  PENALTY_GOAL: "major",
  RED_CARD: "major",
  FULL_TIME: "major",
  PENALTY_MISSED: "medium",
  VAR: "medium",
  YELLOW_CARD: "medium",
  SUBSTITUTION: "medium",
  HALF_TIME: "medium",
  SECOND_HALF: "medium",
  KICK_OFF: "medium",
  SHOT: "minor",
  CORNER: "minor",
  FOUL: "minor",
  FREE_KICK: "minor",
  OFFSIDE: "minor",
};

/*
 * Higher interrupts lower. A goal must never wait behind the corner that led
 * to it, and a red card must never be swallowed by a substitution.
 */
const PRIORITY: Readonly<Record<MatchEventKind, AnimationPriority>> = {
  GOAL: 100,
  OWN_GOAL: 100,
  PENALTY_GOAL: 100,
  RED_CARD: 90,
  VAR: 80,
  PENALTY_MISSED: 70,
  FULL_TIME: 65,
  HALF_TIME: 65,
  SECOND_HALF: 60,
  KICK_OFF: 60,
  SHOT: 50,
  YELLOW_CARD: 45,
  SUBSTITUTION: 40,
  CORNER: 30,
  FREE_KICK: 25,
  FOUL: 20,
  OFFSIDE: 20,
};

const ANIMATION: Readonly<Record<MatchEventKind, AnimationKind>> = {
  GOAL: "GOAL",
  OWN_GOAL: "GOAL",
  PENALTY_GOAL: "GOAL",
  PENALTY_MISSED: "SHOT",
  SHOT: "SHOT",
  RED_CARD: "CARD",
  YELLOW_CARD: "CARD",
  SUBSTITUTION: "SUBSTITUTION",
  VAR: "VAR",
  KICK_OFF: "PERIOD",
  HALF_TIME: "PERIOD",
  SECOND_HALF: "PERIOD",
  FULL_TIME: "PERIOD",
  CORNER: "BALL_MOVE",
  FREE_KICK: "BALL_MOVE",
  FOUL: "NONE",
  OFFSIDE: "NONE",
};

/** Announced to assistive technology. Ordinary play is not, so a screen reader is not flooded. */
const ANNOUNCED: ReadonlySet<MatchEventKind> = new Set<MatchEventKind>([
  "GOAL",
  "OWN_GOAL",
  "PENALTY_GOAL",
  "PENALTY_MISSED",
  "RED_CARD",
  "VAR",
  "HALF_TIME",
  "FULL_TIME",
]);

export function severityOf(kind: MatchEventKind): EventSeverity {
  return SEVERITY[kind] ?? "minor";
}

export function headlineOf(kind: MatchEventKind): string {
  return HEADLINES[kind] ?? "Match event";
}

export function isGoal(kind: MatchEventKind): boolean {
  return kind === "GOAL" || kind === "OWN_GOAL" || kind === "PENALTY_GOAL";
}

/*
 * Where the ball is after this event, when the laws of the game fix it: the
 * centre spot at a restart, the penalty spot, the corner arc, the goal. An
 * event with no inherent location returns nothing and the ball stays put.
 * An own goal is scored into the scorer's own net, so it restarts at the
 * centre like any other goal.
 */
function lawfulBallSpot(
  kind: MatchEventKind,
  side: MatchSide | undefined,
): PitchPoint | undefined {
  switch (kind) {
    case "KICK_OFF":
    case "SECOND_HALF":
    case "GOAL":
    case "OWN_GOAL":
    case "PENALTY_GOAL":
      return PITCH_CENTRE;
    case "PENALTY_MISSED":
      return side === undefined ? undefined : penaltySpot(side);
    case "CORNER":
      return side === undefined ? undefined : cornerFlag(side);
    case "SHOT":
      return side === undefined ? undefined : attackingGoal(side);
    default:
      return undefined;
  }
}

function teamOf(
  match: Pick<MatchView, "home" | "away">,
  side: MatchSide | undefined,
): { readonly name: string; readonly code: string } | undefined {
  if (side === undefined) return undefined;

  const team = side === "HOME" ? match.home : match.away;

  return { name: team.name, code: team.code };
}

/*
 * A sentence built only from what the platform sent. No scorer is named that
 * the platform did not name, no assist is implied, no distance, no body part.
 * With nothing but a team, the line is the team.
 */
function describe(
  event: MatchEventView,
  team: { readonly name: string } | undefined,
): string {
  const who = event.player;
  const team_ = team?.name;

  switch (event.kind) {
    case "GOAL":
    case "PENALTY_GOAL":
      if (who !== undefined && team_ !== undefined) {
        return event.secondaryPlayer === undefined
          ? `${who} scores for ${team_}.`
          : `${who} scores for ${team_}, assisted by ${event.secondaryPlayer}.`;
      }

      return team_ ?? event.description;
    case "OWN_GOAL":
      return who === undefined
        ? (team_ ?? event.description)
        : `${who} puts it into his own net.`;
    case "SUBSTITUTION":
      return who !== undefined && event.secondaryPlayer !== undefined
        ? `${who} replaces ${event.secondaryPlayer}.`
        : (team_ ?? event.description);
    case "YELLOW_CARD":
    case "RED_CARD":
      return who ?? team_ ?? event.description;
    case "CORNER":
    case "FOUL":
    case "OFFSIDE":
    case "FREE_KICK":
    case "SHOT":
    case "PENALTY_MISSED":
      return [who, team_].filter((part) => part !== undefined).join(" · ") ||
        event.description;
    default:
      return event.description;
  }
}

/*
 * Optional pitch coordinates. The platform sends them on the event `detail`
 * bag under these keys; none of this is required, and a surface renders
 * correctly without any of it.
 */
const FROM_X = "fromX";
const FROM_Y = "fromY";
const TO_X = "toX";
const TO_Y = "toY";

/** One platform event, normalised into the single shape every surface draws from. */
export function routeMatchEvent(
  event: MatchEventView,
  match: Pick<MatchView, "home" | "away">,
): PresentationEvent {
  const team = teamOf(match, event.side);
  const to =
    readPoint(event.detail, TO_X, TO_Y) ??
    lawfulBallSpot(event.kind, event.side);

  return {
    id: event.id,
    sequence: event.sequence,
    kind: event.kind,
    minute: event.minute,
    side: event.side,
    teamName: team?.name,
    teamCode: team?.code,
    player: event.player,
    secondaryPlayer: event.secondaryPlayer,
    score: event.score,
    headline: headlineOf(event.kind),
    description: describe(event, team),
    severity: severityOf(event.kind),
    priority: PRIORITY[event.kind] ?? 10,
    animation: ANIMATION[event.kind] ?? "NONE",
    from: readPoint(event.detail, FROM_X, FROM_Y),
    to,
    occurredAt: event.occurredAt,
    announce: ANNOUNCED.has(event.kind),
  };
}

/*
 * The whole stream, newest last, deduplicated on the platform's own event id
 * and ordered by its sequence. Realtime may redeliver an event and a resync
 * may return one already applied; neither may produce a second goal.
 */
export function routeMatchEvents(
  events: readonly MatchEventView[],
  match: Pick<MatchView, "home" | "away">,
): readonly PresentationEvent[] {
  const seen = new Map<string, MatchEventView>();

  for (const event of events) {
    const known = seen.get(event.id);

    // A redelivery of a known id never replaces it with an older sequence.
    if (known === undefined || event.sequence > known.sequence) {
      seen.set(event.id, event);
    }
  }

  return [...seen.values()]
    .sort((a, b) => a.sequence - b.sequence)
    .map((event) => routeMatchEvent(event, match));
}
