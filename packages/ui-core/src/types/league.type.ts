import type { LeagueId } from "@betng/contracts";

export interface LeagueView {
  readonly id: LeagueId;
  readonly name: string;
  readonly code: string;
  readonly country: string;
  readonly teamCount: number;
  readonly matchdays: number;
  readonly currentSeason: number;
  readonly currentMatchday: number;
  readonly cycleSeconds: number;
}
