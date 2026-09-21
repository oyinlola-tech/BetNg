import type { MatchSummary } from "@betng/ui-core";

export interface CompetitionGroup {
  readonly leagueId: string;
  readonly leagueName: string;
  readonly leagueCode: string;
  readonly matches: readonly MatchSummary[];
}

/** Groups in the order the platform listed the matches. */
export function groupByCompetition(matches: readonly MatchSummary[]): readonly CompetitionGroup[] {
  const groups = new Map<string, { leagueId: string; leagueName: string; leagueCode: string; matches: MatchSummary[] }>();

  for (const match of matches) {
    const group = groups.get(match.leagueId);

    if (group === undefined) {
      groups.set(match.leagueId, {
        leagueId: match.leagueId,
        leagueName: match.leagueName,
        leagueCode: match.leagueCode,
        matches: [match],
      });
    } else {
      group.matches.push(match);
    }
  }

  return [...groups.values()];
}
