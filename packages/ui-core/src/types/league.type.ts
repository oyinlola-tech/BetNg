import type { LeagueId } from "@betng/contracts";

export interface LeagueView {
  readonly id: LeagueId;
  readonly name: string;
  readonly code: string;
  /** URL-safe identifier, e.g. `premier-league`. */
  readonly slug: string;
  readonly sport: string;
  readonly status: "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  readonly country: string;
  readonly teamCount: number;
  readonly matchdays: number;
  readonly currentSeason: number;
  readonly currentMatchday: number;
  readonly cycleSeconds: number;
}
