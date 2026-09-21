/** Kobo cross the wire as JSON integers. A value a double cannot hold exactly is refused, never rounded. */
export function toSafeNumber(amount: bigint): number {
  if (amount > BigInt(Number.MAX_SAFE_INTEGER) || amount < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError("The amount does not fit a JSON integer.");
  }

  return Number(amount);
}

/** Integer arithmetic only: 128000n → "₦1,280.00". */
export function formatNaira(kobo: bigint): string {
  const absolute = kobo < 0n ? -kobo : kobo;
  const naira = (absolute / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
  const fraction = (absolute % 100n).toString().padStart(2, "0");

  return `${kobo < 0n ? "-" : ""}₦${naira}.${fraction}`;
}
