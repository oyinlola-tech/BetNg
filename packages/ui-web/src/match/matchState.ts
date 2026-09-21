import {
  formatKickoffTime,
  isFinished,
  isInPlay,
  type DisplayClock,
  type MatchPhase,
  type MatchSide,
  type MatchSummary,
} from "@betng/ui-core";

export const STATE_WORD: Readonly<Record<MatchPhase, string>> = {
  SCHEDULED: "Scheduled",
  BETTING_OPEN: "Betting open",
  BETTING_CLOSED: "Betting closed",
  LIVE: "Live",
  HALFTIME: "Half time",
  FINISHED: "Full time",
  SETTLED: "Full time",
  CANCELLED: "Cancelled",
  POSTPONED: "Postponed",
  SUSPENDED: "Suspended",
  DELAYED: "Delayed",
};

export type MatchOutcome = MatchSide | "DRAW";

/** Only a finished match has a winner, and only from the score the platform reported. */
export function matchOutcome(
  match: Pick<MatchSummary, "phase" | "score">,
): MatchOutcome | undefined {
  if (!isFinished(match.phase)) return undefined;
  if (match.score.home > match.score.away) return "HOME";
  if (match.score.away > match.score.home) return "AWAY";

  return "DRAW";
}

/** A suspended match keeps its score only when the platform reported play had started. */
export function showsScore(
  match: Pick<MatchSummary, "phase" | "clock">,
): boolean {
  if (isInPlay(match.phase) || isFinished(match.phase)) return true;

  return (
    match.phase === "SUSPENDED" &&
    match.clock !== undefined &&
    match.clock.period !== "PRE"
  );
}

export function ordinal(value: number): string {
  const tens = value % 100;

  if (tens >= 11 && tens <= 13) return `${String(value)}th`;

  switch (value % 10) {
    case 1:
      return `${String(value)}st`;
    case 2:
      return `${String(value)}nd`;
    case 3:
      return `${String(value)}rd`;
    default:
      return `${String(value)}th`;
  }
}

export function matchAccessibleName(
  match: MatchSummary,
  clock: DisplayClock | undefined,
): string {
  const scored = showsScore(match);
  const teams = scored
    ? `${match.home.name} ${String(match.score.home)}, ${match.away.name} ${String(match.score.away)}`
    : `${match.home.name} v ${match.away.name}`;
  const parts = [match.leagueName, teams];

  if (match.phase === "LIVE") {
    parts.push("live");
    if (clock !== undefined && clock.minute > 0) {
      parts.push(`${ordinal(clock.minute)} minute`);
    }
  } else {
    if (!scored && match.phase !== "CANCELLED" && match.phase !== "POSTPONED") {
      parts.push(`kick-off ${formatKickoffTime(match.kickoffAt)}`);
    }
    parts.push(STATE_WORD[match.phase].toLowerCase());
  }

  if (match.statusReason !== undefined) parts.push(match.statusReason);

  return parts.join(", ");
}
