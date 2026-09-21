/** Kobo cross the wire as JSON integers. A value a double cannot hold exactly is refused, never rounded. */
export function toSafeNumber(amount: bigint): number {
  if (amount > BigInt(Number.MAX_SAFE_INTEGER) || amount < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError("The amount does not fit a JSON integer.");
  }

  return Number(amount);
}
