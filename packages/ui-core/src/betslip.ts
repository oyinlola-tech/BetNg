/**
 * Bet-slip arithmetic, shared so web, mobile and TV agree on every number.
 *
 * One selection per match: an accumulator across two outcomes of the same
 * match is not a bet the platform offers, so adding a second selection for
 * a match replaces the first. Stakes are kobo integers; the total return
 * is rounded to the kobo the way the betting service will round it.
 */

import type { SlipSelection, SlipTotals } from "./types/index.js";

export const STAKE_LIMITS = Object.freeze({
  /** ₦50 */
  min: 5_000,
  /** ₦500,000 */
  max: 50_000_000,
  /** ₦200 */
  default: 20_000,
});

/** The quick-stake chips every slip shows, in kobo. */
export const QUICK_STAKES: readonly number[] = Object.freeze([
  10_000, 20_000, 50_000, 100_000, 500_000,
]);

export const MAX_SELECTIONS = 20;

/** Adds or replaces a selection. Selecting the same outcome again removes it. */
export function toggleSelection(
  current: readonly SlipSelection[],
  next: SlipSelection,
): readonly SlipSelection[] {
  const existing = current.find((s) => s.selectionId === next.selectionId);

  if (existing !== undefined) {
    return current.filter((s) => s.selectionId !== next.selectionId);
  }

  const withoutMatch = current.filter((s) => s.matchId !== next.matchId);

  if (withoutMatch.length >= MAX_SELECTIONS) return current;

  return [...withoutMatch, next];
}

export function removeSelection(
  current: readonly SlipSelection[],
  selectionId: string,
): readonly SlipSelection[] {
  return current.filter((s) => s.selectionId !== selectionId);
}

export function isSelected(current: readonly SlipSelection[], selectionId: string): boolean {
  return current.some((s) => s.selectionId === selectionId);
}

/** Product of the odds, rounded to two places as the platform does. */
export function combinedOdds(selections: readonly SlipSelection[]): number {
  if (selections.length === 0) return 0;

  const product = selections.reduce((acc, s) => acc * s.odds, 1);

  return Math.round(product * 100) / 100;
}

export function slipTotals(selections: readonly SlipSelection[], stake: number): SlipTotals {
  const totalOdds = combinedOdds(selections);
  const potentialReturn = Math.round(stake * totalOdds);

  return {
    selectionCount: selections.length,
    totalOdds,
    stake,
    potentialReturn,
    potentialProfit: potentialReturn - stake,
  };
}

export type StakeProblem = "EMPTY" | "BELOW_MIN" | "ABOVE_MAX" | "INSUFFICIENT" | undefined;

/** Why a slip cannot be placed, or undefined when it can. */
export function validateSlip(
  selections: readonly SlipSelection[],
  stake: number,
  available: number,
): StakeProblem {
  if (selections.length === 0) return "EMPTY";
  if (!Number.isFinite(stake) || stake < STAKE_LIMITS.min) return "BELOW_MIN";
  if (stake > STAKE_LIMITS.max) return "ABOVE_MAX";
  if (stake > available) return "INSUFFICIENT";
  return undefined;
}

/** Parses a naira string a user typed into kobo. `"1,500.5"` → 150050. */
export function parseStakeInput(text: string): number {
  const cleaned = text.replace(/[^\d.]/g, "");

  if (cleaned === "" || cleaned === ".") return 0;

  const value = Number.parseFloat(cleaned);

  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}
