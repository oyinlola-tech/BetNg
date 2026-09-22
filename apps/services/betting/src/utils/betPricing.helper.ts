import { MAX_TOTAL_ODDS_HUNDREDTHS } from "../constants/index.js";

const DECIMAL_TEXT = /^(\d{1,9})(?:\.(\d{1,2}))?$/;

// Decimal text to integer hundredths: odds never pass through a float on the way to a payout.
export function parseHundredths(text: string): number {
  const match = DECIMAL_TEXT.exec(text.trim());

  if (match === null) {
    throw new Error(`"${text}" is not a two-decimal quantity.`);
  }

  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

export function formatHundredths(hundredths: number): string {
  const whole = Math.trunc(hundredths / 100);
  const fraction = String(hundredths % 100).padStart(2, "0");

  return `${String(whole)}.${fraction}`;
}

// Undefined when the submitted price is not a two-decimal number; it can then never equal a published price.
// String(odds) is the shortest text that round-trips the double, so the check is exact integer arithmetic.
export function submittedHundredths(odds: number): number | undefined {
  if (!Number.isFinite(odds) || odds <= 0) {
    return undefined;
  }

  const match = DECIMAL_TEXT.exec(String(odds));

  if (match === null) {
    return undefined;
  }

  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

export interface SlipPrice {
  readonly totalOddsHundredths: number;
  readonly potentialPayout: number;
}

// Architecture §3: payout = floor(stake × Π h / 100ⁿ), in BigInt. Undefined when the result exceeds the columns or a safe integer.
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
