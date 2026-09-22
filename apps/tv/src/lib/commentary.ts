import { isInPlay, type MatchEventKind, type MatchEventView, type MatchView, type Score } from "@betng/ui-core";

export type Severity = "major" | "medium" | "minor";

const GOAL_KINDS = new Set<MatchEventKind>(["GOAL", "OWN_GOAL", "PENALTY_GOAL"]);
const MEDIUM_KINDS = new Set<MatchEventKind>(["YELLOW_CARD", "RED_CARD", "PENALTY_MISSED", "VAR", "KICK_OFF", "HALF_TIME", "SECOND_HALF", "FULL_TIME"]);
const QUIET_KINDS = new Set<MatchEventKind>([...GOAL_KINDS, "RED_CARD", "FULL_TIME"]);

const HEADLINES: Readonly<Record<MatchEventKind, string>> = {
  KICK_OFF: "Kick-off",
  GOAL: "Goal",
  OWN_GOAL: "Own goal",
  PENALTY_GOAL: "Penalty goal",
  PENALTY_MISSED: "Penalty missed",
  VAR: "VAR check",
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

export function isGoal(kind: MatchEventKind): boolean {
  return GOAL_KINDS.has(kind);
}

export function severityOf(kind: MatchEventKind): Severity {
  if (GOAL_KINDS.has(kind)) return "major";
  if (MEDIUM_KINDS.has(kind)) return "medium";

  return "minor";
}

export function isQuietWorthy(kind: MatchEventKind): boolean {
  return QUIET_KINDS.has(kind);
}

export function headlineOf(kind: MatchEventKind): string {
  return HEADLINES[kind];
}

export interface FeedItem {
  readonly key: string;
  readonly matchId: string;
  readonly sequence: number;
  readonly kind: MatchEventKind;
  readonly severity: Severity;
  readonly minute: number;
  readonly at: number | undefined;
  readonly headline: string;
  readonly detail: string;
  readonly score: Score;
  readonly home: string;
  readonly away: string;
  readonly teamCode: string | undefined;
  readonly teamIds: readonly string[];
}

function timestampOf(event: MatchEventView): number | undefined {
  if (event.occurredAt === "") return undefined;

  const at = Date.parse(event.occurredAt);

  return Number.isFinite(at) ? at : undefined;
}

function detailOf(event: MatchEventView): string {
  if (event.kind === "SUBSTITUTION" && event.player !== undefined && event.secondaryPlayer !== undefined) return `${event.player} for ${event.secondaryPlayer}`;
  if (event.player !== undefined && event.secondaryPlayer !== undefined && isGoal(event.kind)) return `${event.player} · assist ${event.secondaryPlayer}`;

  return event.player ?? event.description;
}

export function toFeedItem(event: MatchEventView, match: MatchView): FeedItem {
  const team = event.side === "HOME" ? match.home : event.side === "AWAY" ? match.away : undefined;

  return {
    key: `${match.id}:${event.id}`,
    matchId: match.id,
    sequence: event.sequence,
    kind: event.kind,
    severity: severityOf(event.kind),
    minute: event.minute,
    at: timestampOf(event),
    headline: headlineOf(event.kind),
    detail: detailOf(event),
    score: event.score,
    home: match.home.code,
    away: match.away.code,
    teamCode: team?.code,
    teamIds: [match.home.id, match.away.id],
  };
}

/* Stream arrivals carry the platform's timestamp and are newer than the REST history, which has none; each group orders within itself. */
export function compareFeed(a: FeedItem, b: FeedItem): number {
  const ga = a.at === undefined ? 1 : 0;
  const gb = b.at === undefined ? 1 : 0;

  if (ga !== gb) return ga - gb;
  if (a.at !== undefined && b.at !== undefined && a.at !== b.at) return b.at - a.at;
  if (a.minute !== b.minute) return b.minute - a.minute;
  if (a.matchId !== b.matchId) return a.matchId < b.matchId ? -1 : 1;

  return b.sequence - a.sequence;
}

export function buildFeed(matches: readonly MatchView[], options: { readonly quiet?: boolean; readonly limit?: number } = {}): readonly FeedItem[] {
  const items = matches.flatMap((match) =>
    match.events.filter((event) => options.quiet !== true || isQuietWorthy(event.kind)).map((event) => toFeedItem(event, match)),
  );

  return items.sort(compareFeed).slice(0, options.limit ?? 400);
}

export interface SpotlightScore {
  readonly matchId: string;
  readonly points: number;
  readonly goals: number;
  readonly reasons: readonly string[];
}

export const LATE_MINUTE = 75;
const RECENT_MINUTES = 10;
export const SPOTLIGHT_MARGIN = 2;

/*
 * Match of the moment, scored only from the platform's timeline:
 * goal 3, red card 2, missed penalty 2, VAR check 1,
 * late (75'+) equaliser +4, late go-ahead goal +2,
 * goal within the last 10 match minutes of the timeline +2,
 * in play with one goal or less between the sides +1.
 */
export function spotlightScore(match: MatchView): SpotlightScore {
  let points = 0;
  let goals = 0;
  let reds = 0;
  let lateEqualiser: number | undefined;
  let lateLead: number | undefined;
  const latest = match.events.reduce((max, e) => Math.max(max, e.minute), 0);

  for (const e of match.events) {
    if (isGoal(e.kind)) {
      goals += 1;
      points += 3;

      const diff = Math.abs(e.score.home - e.score.away);

      if (e.minute >= LATE_MINUTE && diff === 0) {
        points += 4;
        lateEqualiser = e.minute;
      } else if (e.minute >= LATE_MINUTE && diff === 1) {
        points += 2;
        lateLead = e.minute;
      }
      if (latest - e.minute <= RECENT_MINUTES) points += 2;
    } else if (e.kind === "RED_CARD") {
      reds += 1;
      points += 2;
    } else if (e.kind === "PENALTY_MISSED") {
      points += 2;
    } else if (e.kind === "VAR") {
      points += 1;
    }
  }

  const close = isInPlay(match.phase) && Math.abs(match.score.home - match.score.away) <= 1;

  if (close) points += 1;

  const reasons: string[] = [];

  if (lateEqualiser !== undefined) reasons.push(`Late equaliser ${String(lateEqualiser)}'`);
  if (lateLead !== undefined) reasons.push(`Late go-ahead goal ${String(lateLead)}'`);
  if (goals > 0) reasons.push(goals === 1 ? "1 goal" : `${String(goals)} goals`);
  if (reds > 0) reasons.push(reds === 1 ? "Red card" : `${String(reds)} red cards`);
  if (close && goals > 0) reasons.push("One goal in it");

  return { matchId: match.id, points, goals, reasons };
}

function better(a: SpotlightScore & { readonly kickoffAt: string }, b: SpotlightScore & { readonly kickoffAt: string }): boolean {
  if (a.points !== b.points) return a.points > b.points;
  if (a.goals !== b.goals) return a.goals > b.goals;
  if (a.kickoffAt !== b.kickoffAt) return a.kickoffAt < b.kickoffAt;

  return a.matchId < b.matchId;
}

/* The spotlight moves only when another match leads by the margin, so it does not flick between equals. */
export function pickSpotlight(matches: readonly MatchView[], currentId?: string, margin: number = SPOTLIGHT_MARGIN): SpotlightScore | undefined {
  const scored = matches.filter((m) => isInPlay(m.phase)).map((m) => ({ ...spotlightScore(m), kickoffAt: m.kickoffAt }));
  let best: (typeof scored)[number] | undefined;

  for (const s of scored) if (best === undefined || better(s, best)) best = s;

  if (best === undefined) return undefined;

  const current = scored.find((s) => s.matchId === currentId);

  if (current !== undefined && best.points - current.points < margin) return current;

  return best;
}
