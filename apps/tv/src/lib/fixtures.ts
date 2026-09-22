import type { MatchSummary, StandingRow, StandingsView } from "@betng/ui-core";

export function rowFor(standings: StandingsView | undefined, teamId: string): StandingRow | undefined {
  return standings?.rows.find((r) => r.team.id === teamId);
}

export function ordinal(n: number): string {
  const tens = n % 100;

  if (tens >= 11 && tens <= 13) return `${String(n)}th`;

  switch (n % 10) {
    case 1:
      return `${String(n)}st`;
    case 2:
      return `${String(n)}nd`;
    case 3:
      return `${String(n)}rd`;
    default:
      return `${String(n)}th`;
  }
}

export interface Featured {
  readonly matchId: string;
  readonly homePosition: number;
  readonly awayPosition: number;
}

/* Featured: the upcoming meeting whose teams sit highest in the platform's table (lowest sum of positions); earlier kick-off, then id, breaks a tie. No table, no badge. */
export function featuredMatch(matches: readonly MatchSummary[], standings: ReadonlyMap<string, StandingsView>): Featured | undefined {
  let best: (Featured & { readonly sum: number; readonly kickoffAt: string }) | undefined;

  for (const m of matches) {
    const table = standings.get(m.leagueId);
    const home = rowFor(table, m.home.id);
    const away = rowFor(table, m.away.id);

    if (home === undefined || away === undefined) continue;

    const candidate = { matchId: m.id, homePosition: home.position, awayPosition: away.position, sum: home.position + away.position, kickoffAt: m.kickoffAt };

    if (
      best === undefined ||
      candidate.sum < best.sum ||
      (candidate.sum === best.sum && (candidate.kickoffAt < best.kickoffAt || (candidate.kickoffAt === best.kickoffAt && candidate.matchId < best.matchId)))
    )
      best = candidate;
  }

  return best === undefined ? undefined : { matchId: best.matchId, homePosition: best.homePosition, awayPosition: best.awayPosition };
}

export function goalDifferenceBar(goalDifference: number, maxAbs: number): { readonly direction: "up" | "down" | "level"; readonly percent: number } {
  if (goalDifference === 0 || maxAbs <= 0) return { direction: "level", percent: 0 };

  return { direction: goalDifference > 0 ? "up" : "down", percent: Math.min(100, (Math.abs(goalDifference) / maxAbs) * 100) };
}

export function withinNextDay(matches: readonly MatchSummary[], now: number): readonly MatchSummary[] {
  const end = now + 24 * 60 * 60 * 1000;

  return matches
    .filter((m) => {
      const at = Date.parse(m.kickoffAt);

      return Number.isFinite(at) && at >= now && at <= end;
    })
    .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt) || (a.id < b.id ? -1 : 1));
}
