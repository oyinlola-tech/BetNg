/**
 * What a client knows about a team.
 *
 * Extends the contract's `Team` with the presentation facts a screen needs
 * — colours for the badge, the city for a team page — and nothing the
 * simulation needs.
 */

import type { LeagueId, TeamId } from "@betng/contracts";

export interface TeamColors {
  readonly primary: string;
  readonly secondary: string;
  /** Text that reads on `primary`. */
  readonly onPrimary: string;
}

export interface TeamView {
  readonly id: TeamId;
  readonly leagueId: LeagueId;
  readonly name: string;
  /** Up to eight characters, for a compact row. */
  readonly shortName: string;
  /** Exactly three letters, for a badge or a TV strip. */
  readonly code: string;
  readonly city: string;
  readonly stadium: string;
  readonly colors: TeamColors;
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
