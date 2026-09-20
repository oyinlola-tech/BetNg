/**
 * A match as a client renders it.
 *
 * `MatchView` joins the contract's `Match`, `Fixture`, `League` and both
 * `Team`s into one object, so a card or a scoreboard reads one thing.
 * `MatchPhase` extends the contract's `MatchStatus` with the two states a
 * client can *see* but the match service does not store — half-time, and
 * settled — because a viewer and a bettor both care about them.
 */

import type { FixtureId, LeagueId, MatchId, MatchStatus } from "@betng/contracts";
import type { TeamView } from "./team.type.js";

export type MatchPhase =
  | "SCHEDULED"
  | "BETTING_OPEN"
  | "BETTING_CLOSED"
  | "LIVE"
  | "HALFTIME"
  | "FINISHED"
  | "SETTLED"
  | "CANCELLED";

export type MatchSide = "HOME" | "AWAY";

export type MatchEventKind =
  | "KICK_OFF"
  | "GOAL"
  | "YELLOW_CARD"
  | "RED_CARD"
  | "SUBSTITUTION"
  | "CORNER"
  | "SHOT"
  | "HALF_TIME"
  | "SECOND_HALF"
  | "FULL_TIME";

export interface Score {
  readonly home: number;
  readonly away: number;
}

export interface MatchEventView {
  readonly id: string;
  readonly matchId: MatchId;
  /** Per match, strictly increasing from 1. */
  readonly sequence: number;
  readonly kind: MatchEventKind;
  readonly minute: number;
  readonly side?: MatchSide;
  /** The player the event is about: scorer, booked player, player coming on. */
  readonly player?: string;
  /** The assist for a goal, or the player going off for a substitution. */
  readonly secondaryPlayer?: string;
  /** The running score after this event. */
  readonly score: Score;
  readonly description: string;
  readonly occurredAt: string;
}

export interface SideStats {
  readonly possession: number;
  readonly shots: number;
  readonly shotsOnTarget: number;
  readonly corners: number;
  readonly fouls: number;
  readonly offsides: number;
  readonly yellowCards: number;
  readonly redCards: number;
}

export interface MatchStats {
  readonly home: SideStats;
  readonly away: SideStats;
}

export interface MatchView {
  readonly id: MatchId;
  readonly fixtureId: FixtureId;
  readonly leagueId: LeagueId;
  readonly leagueName: string;
  readonly leagueCode: string;
  readonly season: number;
  readonly matchday: number;
  readonly home: TeamView;
  readonly away: TeamView;
  readonly kickoffAt: string;
  readonly bettingClosesAt: string;
  /** The contract status, as the match service reports it. */
  readonly status: MatchStatus;
  /** The presentation phase, derived from status, events and the clock. */
  readonly phase: MatchPhase;
  readonly score: Score;
  /** Events so far, oldest first. Empty before kick-off. */
  readonly events: readonly MatchEventView[];
  /** Present once the match has kicked off. */
  readonly stats?: MatchStats;
  /** How many markets are open, for a lobby row. */
  readonly openMarkets: number;
}

/** A short summary for a strip or a result row. Cheaper than a full view. */
export type MatchSummary = Omit<MatchView, "events" | "stats">;
