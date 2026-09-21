/**
 * League table arithmetic: three points for a win, one for a draw; ordered by points, goal difference, goals
 * scored, then team id so the order is stable.
 */

import type { FormResult } from "@betng/contracts";

export interface PlayedMatch {
  readonly homeTeamId: string;
  readonly awayTeamId: string;
  readonly homeGoals: number;
  readonly awayGoals: number;
  readonly completedAt: Date;
}

export interface TableRow {
  readonly position: number;
  readonly teamId: string;
  readonly played: number;
  readonly won: number;
  readonly drawn: number;
  readonly lost: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly goalDifference: number;
  readonly points: number;
  /** The last five results, oldest first. */
  readonly form: readonly FormResult[];
}

interface Tally {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  form: FormResult[];
}

const FORM_LENGTH = 5;

function record(tally: Tally, scored: number, conceded: number): void {
  const outcome: FormResult = scored > conceded ? "W" : scored < conceded ? "L" : "D";

  tally.played += 1;
  tally.goalsFor += scored;
  tally.goalsAgainst += conceded;
  tally.won += outcome === "W" ? 1 : 0;
  tally.drawn += outcome === "D" ? 1 : 0;
  tally.lost += outcome === "L" ? 1 : 0;
  tally.form.push(outcome);
}

export function computeStandings(teamIds: readonly string[], matches: readonly PlayedMatch[]): readonly TableRow[] {
  const tallies = new Map<string, Tally>();
  const tallyOf = (teamId: string): Tally => {
    const existing = tallies.get(teamId);

    if (existing !== undefined) return existing;

    const created: Tally = { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, form: [] };

    tallies.set(teamId, created);

    return created;
  };

  teamIds.forEach(tallyOf);

  for (const match of [...matches].sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime())) {
    record(tallyOf(match.homeTeamId), match.homeGoals, match.awayGoals);
    record(tallyOf(match.awayTeamId), match.awayGoals, match.homeGoals);
  }

  return [...tallies.entries()]
    .map(([teamId, tally]) => ({
      teamId,
      played: tally.played,
      won: tally.won,
      drawn: tally.drawn,
      lost: tally.lost,
      goalsFor: tally.goalsFor,
      goalsAgainst: tally.goalsAgainst,
      goalDifference: tally.goalsFor - tally.goalsAgainst,
      points: tally.won * 3 + tally.drawn,
      form: tally.form.slice(-FORM_LENGTH),
    }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor ||
        a.teamId.localeCompare(b.teamId),
    )
    .map((row, index) => ({ position: index + 1, ...row }));
}
