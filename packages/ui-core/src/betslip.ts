/** Bet-slip arithmetic, shared so web, mobile and TV agree on every number. */

import type { SlipSelection, SlipTotals } from "./types/index.js";

export const STAKE_LIMITS = Object.freeze({
  min: 5_000,
  max: 50_000_000,
  default: 20_000,
});

export const QUICK_STAKES: readonly number[] = Object.freeze([
  10_000, 20_000, 50_000, 100_000, 500_000,
]);

export const MAX_SELECTIONS = 20;

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

export function isSelected(
  current: readonly SlipSelection[],
  selectionId: string,
): boolean {
  return current.some((s) => s.selectionId === selectionId);
}

export function combinedOdds(selections: readonly SlipSelection[]): number {
  if (selections.length === 0) return 0;

  const product = selections.reduce((acc, s) => acc * s.odds, 1);

  return Math.round(product * 100) / 100;
}

export function slipTotals(
  selections: readonly SlipSelection[],
  stake: number,
): SlipTotals {
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

export type StakeProblem =
  "EMPTY" | "BELOW_MIN" | "ABOVE_MAX" | "INSUFFICIENT" | undefined;

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

export function parseStakeInput(text: string): number {
  const cleaned = text.replace(/[^\d.]/g, "");

  if (cleaned === "" || cleaned === ".") return 0;

  const value = Number.parseFloat(cleaned);

  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}
