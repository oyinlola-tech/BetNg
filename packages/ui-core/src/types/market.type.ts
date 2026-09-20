/**
 * Markets as a client lays them out.
 *
 * The contract knows three market types. The UI is built for six, so that
 * when the odds service grows the client already has a place for each. A
 * `MarketKind` the client does not recognise renders through the generic
 * layout rather than breaking.
 */

import type { MarketId, MarketStatus, MatchId, SelectionId } from "@betng/contracts";

export type MarketKind =
  | "MATCH_RESULT"
  | "DOUBLE_CHANCE"
  | "OVER_UNDER"
  | "BOTH_TEAMS_TO_SCORE"
  | "CORRECT_SCORE"
  | "GOAL_SPREAD";

export type OddsTrend = "UP" | "DOWN" | "STEADY";

export interface SelectionView {
  readonly id: SelectionId;
  readonly marketId: MarketId;
  readonly code: string;
  readonly label: string;
  /** Short form for a tight grid: "1", "X", "2", "O 2.5". */
  readonly shortLabel: string;
  readonly odds: number;
  readonly probability: number;
  readonly trend: OddsTrend;
}

export interface MarketView {
  readonly id: MarketId;
  readonly matchId: MatchId;
  readonly kind: MarketKind;
  readonly name: string;
  /** The line for a totals or spread market, e.g. 2.5 or -1. */
  readonly line?: number;
  readonly status: MarketStatus;
  /** How many selections sit on one row. Correct score uses 3; totals 2. */
  readonly columns: number;
  readonly selections: readonly SelectionView[];
}

export interface MatchMarketsView {
  readonly matchId: MatchId;
  readonly markets: readonly MarketView[];
  readonly generatedAt: string;
}
