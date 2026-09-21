import { estimateReturn, multiplyOdds, parseMoney } from "./money.js";
import type {
  SlipSelection,
  SlipTotals,
  StakeLimits,
} from "./types/index.js";

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
  return multiplyOdds(selections.map((s) => s.odds));
}

export function slipTotals(
  selections: readonly SlipSelection[],
  stake: number,
): SlipTotals {
  const potentialReturn = estimateReturn(
    stake,
    selections.map((s) => s.odds),
  );

  return {
    selectionCount: selections.length,
    totalOdds: combinedOdds(selections),
    stake,
    potentialReturn,
    potentialProfit: Math.max(0, potentialReturn - stake),
  };
}

export type StakeProblem =
  "EMPTY" | "BELOW_MIN" | "ABOVE_MAX" | "INSUFFICIENT" | undefined;

export function validateSlip(
  selections: readonly SlipSelection[],
  stake: number,
  available: number,
  limits: Pick<StakeLimits, "min" | "max"> = STAKE_LIMITS,
): StakeProblem {
  if (selections.length === 0) return "EMPTY";
  if (!Number.isFinite(stake) || stake < limits.min) return "BELOW_MIN";
  if (stake > limits.max) return "ABOVE_MAX";
  if (stake > available) return "INSUFFICIENT";
  return undefined;
}

export function parseStakeInput(text: string): number {
  return parseMoney(text.replace(/[^\d.,]/g, "")) ?? 0;
}

/** A reference for one submission attempt. Reused on retry so the platform can deduplicate. */
export function createClientReference(): string {
  return globalThis.crypto.randomUUID();
}
