export type SearchKind = "TEAM" | "MATCH" | "LEAGUE" | "PLAYER" | "MARKET";

export interface SearchQuery {
  readonly term: string;
  readonly kinds?: readonly SearchKind[];
  readonly limit?: number;
}

export interface SearchHit {
  readonly kind: SearchKind;
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly matchId?: string;
  readonly leagueId?: string;
  readonly teamId?: string;
}

export interface SearchResults {
  readonly term: string;
  readonly hits: readonly SearchHit[];
}
