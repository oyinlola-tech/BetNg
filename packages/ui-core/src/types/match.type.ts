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
  readonly sequence: number;
  readonly kind: MatchEventKind;
  readonly minute: number;
  readonly side?: MatchSide;
  readonly player?: string;
  readonly secondaryPlayer?: string;
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
  readonly status: MatchStatus;
  readonly phase: MatchPhase;
  readonly score: Score;
  readonly events: readonly MatchEventView[];
  readonly stats?: MatchStats;
  readonly openMarkets: number;
}

export type MatchSummary = Omit<MatchView, "events" | "stats">;
