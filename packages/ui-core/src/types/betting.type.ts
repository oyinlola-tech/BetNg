/**
 * Bets and the slip they are built on.
 *
 * Every amount here is simulated play-money in kobo. Nothing in this
 * package can move real funds; the wallet is a number in a store.
 */

import type { BetId, BetStatus, MarketId, MatchId, SelectionId } from "@betng/contracts";
import type { MarketKind } from "./market.type.js";

/** One line on the bet slip, before it becomes a bet. */
export interface SlipSelection {
  readonly selectionId: SelectionId;
  readonly marketId: MarketId;
  readonly matchId: MatchId;
  readonly marketKind: MarketKind;
  readonly marketName: string;
  readonly selectionLabel: string;
  readonly odds: number;
  /** "Lagos FC v Port Harcourt City", for the slip row. */
  readonly matchLabel: string;
  readonly leagueCode: string;
  readonly kickoffAt: string;
}

export interface SlipTotals {
  readonly selectionCount: number;
  readonly totalOdds: number;
  /** Stake in kobo. */
  readonly stake: number;
  /** Simulated return if every leg wins, in kobo. */
  readonly potentialReturn: number;
  readonly potentialProfit: number;
}

export type SelectionOutcome = "PENDING" | "WON" | "LOST" | "VOID";

/** One leg of a placed bet, with what it was on and how it went. */
export interface BetLegView extends SlipSelection {
  readonly outcome: SelectionOutcome;
  /** The final score, once known. */
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
  /** The amount actually paid, once settled. Zero for a loss. */
  readonly payout?: number;
}

export interface PlaceBetInput {
  readonly selections: readonly SlipSelection[];
  readonly stake: number;
}
