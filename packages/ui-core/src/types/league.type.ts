/**
 * A virtual competition as a client sees it.
 */

import type { LeagueId } from "@betng/contracts";

export interface LeagueView {
  readonly id: LeagueId;
  readonly name: string;
  readonly code: string;
  readonly country: string;
  readonly teamCount: number;
  /** Matchdays in one season. */
  readonly matchdays: number;
  /** The season currently being played, one-based. */
  readonly currentSeason: number;
  /** The matchday currently in play or next to kick off. */
  readonly currentMatchday: number;
  /** Seconds between one matchday's kickoff and the next. */
  readonly cycleSeconds: number;
}
