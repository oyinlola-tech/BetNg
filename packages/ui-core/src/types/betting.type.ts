import type {
  BetId,
  BetStatus,
  MarketId,
  MatchId,
  SelectionId,
} from "@betng/contracts";
import type { MarketKind } from "./market.type.js";

export interface SlipSelection {
  readonly selectionId: SelectionId;
  readonly marketId: MarketId;
  readonly matchId: MatchId;
  readonly marketKind: MarketKind;
  readonly marketName: string;
  readonly selectionLabel: string;
  readonly odds: number;
  readonly matchLabel: string;
  readonly leagueCode: string;
  readonly kickoffAt: string;
  readonly oddsVersion?: number;
}

export interface SlipTotals {
  readonly selectionCount: number;
  readonly totalOdds: number;
  readonly stake: number;
  readonly potentialReturn: number;
  readonly potentialProfit: number;
}

export type SelectionOutcome =
  "PENDING" | "WON" | "LOST" | "VOID" | "CANCELLED";

export interface BetLegView extends SlipSelection {
  readonly outcome: SelectionOutcome;
  readonly result?: string;
}

export interface BetView {
  readonly id: BetId;
  readonly legs: readonly BetLegView[];
  readonly stake: number;
  readonly totalOdds: number;
  readonly potentialPayout: number;
  readonly status: BetStatus;
  readonly placedAt: string;
  readonly settledAt?: string;
  readonly payout?: number;
  readonly currency?: string;
  readonly reference?: string;
}

export interface PlaceBetInput {
  readonly selections: readonly SlipSelection[];
  readonly stake: number;
  /** One per submission attempt, reused on retry so the platform can deduplicate. */
  readonly clientReference: string;
}

export type BetPlacementOutcome =
  "ACCEPTED" | "PARTIALLY_ACCEPTED" | "LIMITED" | "REJECTED" | "EXPIRED";

export type BetRejectionReason =
  | "MARKET_CLOSED"
  | "MARKET_SUSPENDED"
  | "ODDS_CHANGED"
  | "STAKE_LIMITED"
  | "RISK_REJECTED"
  | "INSUFFICIENT_FUNDS"
  | "INVALID_BET";

/** What the platform decided about a submission. Business refusals arrive here; transport and session failures are thrown. */
export interface BetPlacementView {
  readonly outcome: BetPlacementOutcome;
  readonly clientReference: string;
  readonly bet?: BetView;
  readonly reason?: BetRejectionReason;
  readonly message?: string;
  readonly maxStake?: number;
  readonly rejectedSelectionIds?: readonly SelectionId[];
}

export type BetLifecycle =
  | "DRAFT"
  | "SUBMITTING"
  | "ACCEPTED"
  | "PARTIALLY_ACCEPTED"
  | "LIMITED"
  | "REJECTED"
  | "CANCELLED"
  | "SETTLED"
  | "VOID"
  | "EXPIRED";
