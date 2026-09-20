/**
 * Bets and the slip they are built on.
 *
 * Every amount here is simulated play-money in kobo. Nothing in this
 * package can move real funds; the wallet is a number in a store.
 */

import type { BetId, BetStatus, MarketId, MatchId, SelectionId } from "@betng/contracts";
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
}

export interface SlipTotals {
  readonly selectionCount: number;
  readonly totalOdds: number;
  readonly stake: number;
  readonly potentialReturn: number;
  readonly potentialProfit: number;
}

export type SelectionOutcome = "PENDING" | "WON" | "LOST" | "VOID";

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
}

export interface PlaceBetInput {
  readonly selections: readonly SlipSelection[];
  readonly stake: number;
}
