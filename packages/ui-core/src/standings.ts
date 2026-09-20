/**
 * League table arithmetic.
 *
 * Standings are a projection of completed results. Computing them from
 * the results rather than storing them separately means the table can
 * never disagree with the scores beneath it.
 */

import type { LeagueId } from "@betng/contracts";
import type {
  FormResult,
  MatchSummary,
  StandingRow,
  StandingsView,
  TeamView,
} from "./types/index.js";

interface Tally {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  form: FormResult[];
}

function blank(): Tally {
  return { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, form: [] };
}

export function computeStandings(
  leagueId: LeagueId,
  season: number,
  teams: readonly TeamView[],
  results: readonly MatchSummary[],
): StandingsView {
  const tallies = new Map<string, Tally>();

  for (const team of teams) tallies.set(team.id, blank());

  let matchdaysPlayed = 0;

  for (const match of results) {
    const home = tallies.get(match.home.id);
    const away = tallies.get(match.away.id);

    if (home === undefined || away === undefined) continue;

    matchdaysPlayed = Math.max(matchdaysPlayed, match.matchday);

    const { home: hg, away: ag } = match.score;

    home.played += 1;
    away.played += 1;
    home.goalsFor += hg;
    home.goalsAgainst += ag;
    away.goalsFor += ag;
    away.goalsAgainst += hg;

    if (hg > ag) {
      home.won += 1;
      away.lost += 1;
      home.form.push("W");
      away.form.push("L");
    } else if (hg < ag) {
      away.won += 1;
      home.lost += 1;
      home.form.push("L");
      away.form.push("W");
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.form.push("D");
      away.form.push("D");
    }
  }

  const rows = teams
    .map((team): Omit<StandingRow, "position"> => {
      const t = tallies.get(team.id) ?? blank();

      return {
        team,
        played: t.played,
        won: t.won,
        drawn: t.drawn,
        lost: t.lost,
        goalsFor: t.goalsFor,
        goalsAgainst: t.goalsAgainst,
        goalDifference: t.goalsFor - t.goalsAgainst,
        points: t.won * 3 + t.drawn,
        form: t.form.slice(-5),
      };
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor ||
        a.team.name.localeCompare(b.team.name),
    )
    .map((row, index): StandingRow => ({ ...row, position: index + 1 }));

  return { leagueId, season, matchdaysPlayed, rows };
}
