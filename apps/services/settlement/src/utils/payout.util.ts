/**
 * Payout arithmetic (`docs/architecture.md` §3): integers only, BigInt throughout.
 *
 * With each non-void leg's stored odds as integer hundredths `h_i`,
 * `payout = floor(stake * Π h_i / 100^n)`. A void leg counts as 1.00 and drops out of the product.
 * The odds are the ones stored on the bet leg at acceptance, never a current market price.
 */

import type { LegOutcome } from "./evaluation.util.js";

export type BetOutcome = "WON" | "LOST" | "VOID";

export interface ResolvedLeg {
  readonly outcome: LegOutcome;
  /** `betting.bet_selections.odds` as text, e.g. "2.50". */
  readonly odds: string;
}

export interface BetResolution {
  readonly outcome: BetOutcome;
  readonly payout: bigint;
}

const ODDS_TEXT = /^(\d{1,6})(?:\.(\d{1,2}))?$/;

const HUNDRED = 100n;

export function oddsToHundredths(odds: string): bigint {
  const match = ODDS_TEXT.exec(odds.trim());

  if (match === null) {
    throw new RangeError("Stored odds are not a decimal with at most two places.");
  }

  const hundredths = BigInt(match[1] ?? "0") * HUNDRED + BigInt((match[2] ?? "").padEnd(2, "0"));

  if (hundredths <= 0n) {
    throw new RangeError("Stored odds must be positive.");
  }

  return hundredths;
}

export function resolveBet(stake: bigint, legs: readonly ResolvedLeg[]): BetResolution {
  if (stake < 0n) {
    throw new RangeError("A stake is never negative.");
  }

  if (legs.length === 0) {
    throw new RangeError("A bet has at least one leg.");
  }

  if (legs.some((leg) => leg.outcome === "LOST")) {
    return { outcome: "LOST", payout: 0n };
  }

  const winning = legs.filter((leg) => leg.outcome === "WON");

  if (winning.length === 0) {
    return { outcome: "VOID", payout: stake };
  }

  let numerator = stake;
  let denominator = 1n;

  for (const leg of winning) {
    numerator *= oddsToHundredths(leg.odds);
    denominator *= HUNDRED;
  }

  // BigInt division truncates, which is floor for non-negative operands.
  return { outcome: "WON", payout: numerator / denominator };
}
