/**
 * Slip pricing in integers (`docs/architecture.md` §3).
 *
 * Odds are integer hundredths and money is integer kobo, multiplied as
 * `BigInt`, so a price such as 2.15 — which binary floating point cannot
 * represent — never passes through a float on its way to a payout.
 */

import { MAX_TOTAL_ODDS_HUNDREDTHS } from "../constants/index.js";

const DECIMAL_TEXT = /^(\d{1,9})(?:\.(\d{1,2}))?$/;

/** Reads a `numeric(n,2)` rendered as text ("2.15", "3.4", "11") as hundredths. */
export function parseHundredths(text: string): number {
  const match = DECIMAL_TEXT.exec(text.trim());

  if (match === null) {
    throw new Error(`"${text}" is not a two-decimal quantity.`);
  }

  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

/** Renders hundredths as the decimal text PostgreSQL stores. */
export function formatHundredths(hundredths: number): string {
  const whole = Math.trunc(hundredths / 100);
  const fraction = String(hundredths % 100).padStart(2, "0");

  return `${String(whole)}.${fraction}`;
}

/**
 * A price a client submitted, as hundredths; `undefined` when it is not a
 * two-decimal number, which can never equal a published price.
 */
export function submittedHundredths(odds: number): number | undefined {
  const scaled = odds * 100;
  const rounded = Math.round(scaled);

  return Math.abs(scaled - rounded) < 1e-6 ? rounded : undefined;
}

export interface SlipPrice {
  /** Π odds, rounded down to two decimals. For display. */
  readonly totalOddsHundredths: number;
  /** `floor(stake × Π h / 100ⁿ)`, in kobo. */
  readonly potentialPayout: number;
}

/**
 * Prices a slip. Returns `undefined` when the product is larger than the
 * columns — or a JSON number — can carry exactly.
 */
export function priceSlip(
  stake: number,
  legHundredths: readonly number[],
): SlipPrice | undefined {
  if (!Number.isSafeInteger(stake) || stake <= 0 || legHundredths.length === 0) {
    throw new Error("A slip needs a positive integer stake and at least one leg.");
  }

  let product = 1n;

  for (const hundredths of legHundredths) {
    if (!Number.isSafeInteger(hundredths) || hundredths <= 100) {
      throw new Error("Odds must be integer hundredths above 1.00.");
    }

    product *= BigInt(hundredths);
  }

  const legs = BigInt(legHundredths.length);
  const potentialPayout = (BigInt(stake) * product) / 100n ** legs;
  const totalOddsHundredths = product / 100n ** (legs - 1n);

  if (
    totalOddsHundredths > MAX_TOTAL_ODDS_HUNDREDTHS ||
    potentialPayout > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    return undefined;
  }

  return {
    totalOddsHundredths: Number(totalOddsHundredths),
    potentialPayout: Number(potentialPayout),
  };
}
