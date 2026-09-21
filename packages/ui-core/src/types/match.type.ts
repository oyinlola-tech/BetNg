import type {
  FixtureId,
  LeagueId,
  MatchId,
  MatchStatus,
} from "@betng/contracts";
import type { TeamView } from "./team.type.js";

export type MatchPhase =
  | "SCHEDULED"
  | "BETTING_OPEN"
  | "BETTING_CLOSED"
  | "LIVE"
  | "HALFTIME"
  | "FINISHED"
  | "SETTLED"
  | "CANCELLED"
  | "POSTPONED"
  | "SUSPENDED"
  | "DELAYED";

export type MatchSide = "HOME" | "AWAY";

export type MatchEventKind =
  | "KICK_OFF"
  | "GOAL"
  | "OWN_GOAL"
  | "PENALTY_GOAL"
  | "PENALTY_MISSED"
  | "VAR"
  | "OFFSIDE"
  | "FOUL"
  | "FREE_KICK"
  | "YELLOW_CARD"
  | "RED_CARD"
  | "SUBSTITUTION"
  | "CORNER"
  | "SHOT"
  | "HALF_TIME"
  | "SECOND_HALF"
  | "FULL_TIME";

export type ClockPeriod =
  "PRE" | "FIRST_HALF" | "HALF_TIME" | "SECOND_HALF" | "FULL_TIME";

/** The match clock as the platform last reported it. */
export interface MatchClockView {
  readonly period: ClockPeriod;
  readonly minute: number;
  readonly addedMinutes?: number;
  readonly asOf: string;
  /** Real milliseconds per match minute. When present a client may advance the displayed minute between reports, within the period. */
  readonly minuteLengthMs?: number;
}

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
  readonly detail?: Readonly<Record<string, string | number | boolean>>;
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
  readonly expectedGoals?: number;
  readonly extra?: readonly ExtraStat[];
}

export interface ExtraStat {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly unit?: "PERCENT" | "COUNT";
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
  readonly clock?: MatchClockView;
  readonly lifecycle?: string;
  readonly statusReason?: string;
  readonly score: Score;
  readonly events: readonly MatchEventView[];
  readonly stats?: MatchStats;
  readonly openMarkets: number;
  readonly updatedAt?: string;
}

export type MatchSummary = Omit<MatchView, "events" | "stats">;
