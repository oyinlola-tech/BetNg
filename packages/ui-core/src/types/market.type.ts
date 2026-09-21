import type {
  MarketId,
  MarketStatus,
  MatchId,
  SelectionId,
} from "@betng/contracts";

export type MarketKind =
  | "MATCH_RESULT"
  | "DOUBLE_CHANCE"
  | "OVER_UNDER"
  | "BOTH_TEAMS_TO_SCORE"
  | "CORRECT_SCORE"
  | "GOAL_SPREAD";

export type OddsTrend = "UP" | "DOWN" | "STEADY";

export type SelectionStatus = "OPEN" | "SUSPENDED" | "UNAVAILABLE";

/** How a client groups markets into tabs. From the platform when it sends one, otherwise by kind. */
export type MarketGroupKey = "MAIN" | "GOALS" | "SCORE" | "HANDICAP" | "OTHER";

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
