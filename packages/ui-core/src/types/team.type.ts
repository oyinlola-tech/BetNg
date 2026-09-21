import type { LeagueId, TeamId } from "@betng/contracts";

export interface TeamColors {
  readonly primary: string;
  readonly secondary: string;
  readonly onPrimary: string;
}

export interface TeamCrestView {
  readonly assetUrl?: string;
  readonly shape?: string;
  readonly pattern?: string;
  readonly emblem?: string;
  readonly accent?: string;
}

export interface TeamView {
  readonly id: TeamId;
  readonly leagueId: LeagueId;
  readonly name: string;
  readonly shortName: string;
  readonly code: string;
  readonly city: string;
  readonly stadium: string;
  readonly colors: TeamColors;
  readonly crest?: TeamCrestView;
  /** Simulated strength, 0 to 100. Shown on a team page, never on odds. */
  readonly strength: number;
}

export interface Player {
  readonly id: string;
  readonly name: string;
  readonly position: "GK" | "DF" | "MF" | "FW";
  readonly shirt: number;
}

export interface TeamDetailView extends TeamView {
  readonly manager: string;
  readonly founded: number;
  readonly squad: readonly Player[];
}
