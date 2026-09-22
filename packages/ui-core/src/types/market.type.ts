import type {
  MarketId,
  MarketStatus,
  MatchId,
  SelectionId,
} from "@betng/contracts";

/** The market kinds this build names and lays out itself. */
export type KnownMarketKind =
  | "MATCH_RESULT"
  | "DOUBLE_CHANCE"
  | "DRAW_NO_BET"
  | "OVER_UNDER"
  | "BOTH_TEAMS_TO_SCORE"
  | "ODD_EVEN"
  | "GOAL_BAND"
  | "TEAM_TOTAL"
  | "TEAM_TO_SCORE"
  | "CLEAN_SHEET"
  | "TEAM_TO_SCORE_FIRST"
  | "HALF_TIME_RESULT"
  | "HALF_TIME_DOUBLE_CHANCE"
  | "HALF_TIME_OVER_UNDER"
  | "HALF_TIME_FULL_TIME"
  | "CORRECT_SCORE"
  | "HALF_TIME_CORRECT_SCORE"
  | "WINNING_MARGIN"
  | "GOAL_SPREAD"
  | "ASIAN_HANDICAP"
  | "TOTAL_CORNERS"
  | "TEAM_CORNERS"
  | "TOTAL_CARDS"
  | "FIRST_GOAL_METHOD";

/*
 * The platform owns the catalogue, so a kind it publishes that this build has
 * never seen is data, not an error: it still renders, under an inferred name
 * and group. The known kinds stay in the union for autocomplete.
 */
export type MarketKind = KnownMarketKind | (string & {});

export type OddsTrend = "UP" | "DOWN" | "STEADY";

export type SelectionStatus = "OPEN" | "SUSPENDED" | "UNAVAILABLE";

/** How a client groups markets into tabs. From the platform when it sends one, otherwise inferred from the kind. */
export type MarketGroupKey =
  | "MAIN"
  | "GOALS"
  | "TEAMS"
  | "HALF"
  | "SCORE"
  | "HANDICAP"
  | "SPECIALS"
  | "OTHER";

export interface SelectionView {
  readonly id: SelectionId;
  readonly marketId: MarketId;
  readonly code: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly odds: number;
  readonly probability: number;
  readonly trend: OddsTrend;
  readonly status?: SelectionStatus;
}

export interface MarketView {
  readonly id: MarketId;
  readonly matchId: MatchId;
  readonly kind: MarketKind;
  readonly name: string;
  readonly line?: number;
  readonly status: MarketStatus;
  readonly columns: number;
  readonly selections: readonly SelectionView[];
  readonly group?: MarketGroupKey;
  readonly oddsVersion?: number;
  readonly suspensionReason?: string;
  readonly updatedAt?: string;
}

export interface MatchMarketsView {
  readonly matchId: MatchId;
  readonly markets: readonly MarketView[];
  readonly generatedAt: string;
}
