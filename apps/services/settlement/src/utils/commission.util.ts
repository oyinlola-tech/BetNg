/**
 * Commission arithmetic: integers only. A percent with two decimal places is carried as basis points.
 */

const PERCENT_TEXT = /^(\d{1,3})(?:\.(\d{1,2}))?$/;

const FULL_SHARE_BASIS_POINTS = 10_000;

/** "12.5" → 1250. Accepts a NUMERIC(5,2) rendered as text, or a request number with at most two places. */
export function percentToBasisPoints(percent: string | number): number {
  const text = typeof percent === "number" ? String(percent) : percent.trim();
  const match = PERCENT_TEXT.exec(text);

  if (match === null) {
    throw new RangeError("A share percent has at most two decimal places.");
  }

  const basisPoints = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));

  if (basisPoints > FULL_SHARE_BASIS_POINTS) {
    throw new RangeError("A share percent is between 0 and 100.");
  }

  return basisPoints;
}

/** 1250 → "12.50", the text form PostgreSQL casts to NUMERIC(5,2) without rounding. */
export function basisPointsToPercentText(basisPoints: number): string {
  const whole = Math.trunc(basisPoints / 100);
  const fraction = basisPoints % 100;

  return `${String(whole)}.${String(fraction).padStart(2, "0")}`;
}

export function basisPointsToPercent(basisPoints: number): number {
  return basisPoints / 100;
}

export interface CommissionSplit {
  readonly shopShareBasisPoints: number;
  readonly shopShareAmount: bigint;
  readonly platformShareBasisPoints: number;
  readonly platformShareAmount: bigint;
}

/**
 * Splits a shop's realised operator result.
 *
 * The shop shares in a positive result only. A zero or negative result leaves the shop with nothing and the
 * whole (negative) figure on the platform side: it is recorded, and no wallet absorbs it.
 */
export function splitCommission(operatorResult: bigint, shopShareBasisPoints: number): CommissionSplit {
  if (
    !Number.isInteger(shopShareBasisPoints) ||
    shopShareBasisPoints < 0 ||
    shopShareBasisPoints > FULL_SHARE_BASIS_POINTS
  ) {
    throw new RangeError("A share percent is between 0 and 100.");
  }

  const shopShareAmount =
    operatorResult > 0n
      ? (operatorResult * BigInt(shopShareBasisPoints)) / BigInt(FULL_SHARE_BASIS_POINTS)
      : 0n;

  return {
    shopShareBasisPoints,
    shopShareAmount,
    platformShareBasisPoints: FULL_SHARE_BASIS_POINTS - shopShareBasisPoints,
    platformShareAmount: operatorResult - shopShareAmount,
  };
}
