/**
 * League tables and scorer charts.
 */

import type { LeagueId } from "@betng/contracts";
import type { TeamView } from "./team.type.js";

export type FormResult = "W" | "D" | "L";

export interface StandingRow {
  readonly position: number;
  readonly team: TeamView;
  readonly played: number;
  readonly won: number;
  readonly drawn: number;
  readonly lost: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly goalDifference: number;
  readonly points: number;
  /** Most recent last, up to five. */
  readonly form: readonly FormResult[];
}

export interface StandingsView {
  readonly leagueId: LeagueId;
  readonly season: number;
  /** Matchdays completed so far this season. */
  readonly matchdaysPlayed: number;
  readonly rows: readonly StandingRow[];
}

export interface TopScorer {
  readonly player: string;
  readonly team: TeamView;
  readonly goals: number;
  readonly assists: number;
}
