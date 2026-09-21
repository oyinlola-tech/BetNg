import type { MatchId, TeamId } from "@betng/contracts";
import type { MatchSide, Score } from "./match.type.js";
import type { TeamView } from "./team.type.js";

export type PlayerPosition = "GK" | "DF" | "MF" | "FW";

export interface LineupPlayer {
  readonly id: string;
  readonly name: string;
  readonly shirt?: number;
  readonly position?: PlayerPosition;
  readonly captain?: boolean;
  readonly grid?: { readonly row: number; readonly slot: number };
  readonly substitutedMinute?: number;
}

export interface TeamLineup {
  readonly teamId: TeamId;
  readonly side: MatchSide;
  readonly formation?: string;
  readonly manager?: string;
  readonly starting: readonly LineupPlayer[];
  readonly substitutes: readonly LineupPlayer[];
}

export interface MatchLineupsView {
  readonly matchId: MatchId;
  readonly confirmed: boolean;
  readonly home?: TeamLineup;
  readonly away?: TeamLineup;
}

export interface HeadToHeadMeeting {
  readonly matchId: MatchId;
  readonly kickoffAt: string;
  readonly leagueCode: string;
  readonly home: TeamView;
  readonly away: TeamView;
  readonly score: Score;
}

export interface HeadToHeadView {
  readonly matchId: MatchId;
  readonly played: number;
  readonly homeWins: number;
  readonly draws: number;
  readonly awayWins: number;
  readonly meetings: readonly HeadToHeadMeeting[];
}
