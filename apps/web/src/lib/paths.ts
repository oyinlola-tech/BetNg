import type { SearchHit } from "@betng/ui-core";

export const paths = {
  home: "/",
  football: "/football",
  live: "/live",
  virtuals: "/virtuals",
  results: "/results",
  standings: "/standings",
  leagues: "/leagues",
  league: (leagueId: string) => `/leagues/${leagueId}`,
  match: (matchId: string, tab?: string) => `/matches/${matchId}${tab === undefined ? "" : `?tab=${tab}`}`,
  team: (teamId: string) => `/teams/${teamId}`,
  search: (term: string) => `/search?q=${encodeURIComponent(term)}`,
  tickets: "/tickets",
  wallet: "/wallet",
  transactions: "/transactions",
  notifications: "/notifications",
  account: "/account",
  settings: "/settings",
  help: (section?: string) => `/help${section === undefined ? "" : `#${section}`}`,
} as const;

export function searchHitPath(hit: SearchHit): string | undefined {
  switch (hit.kind) {
    case "TEAM":
      return paths.team(hit.teamId ?? hit.id);
    case "LEAGUE":
      return paths.league(hit.leagueId ?? hit.id);
    case "MATCH":
      return paths.match(hit.matchId ?? hit.id);
    case "MARKET":
      return hit.matchId === undefined ? undefined : paths.match(hit.matchId, "markets");
    case "PLAYER":
      return hit.teamId === undefined ? undefined : paths.team(hit.teamId);
  }
}
