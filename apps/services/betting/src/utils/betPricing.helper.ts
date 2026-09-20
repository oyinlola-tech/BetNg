/**
 * Multiplies the legs' odds into the slip's price.
 *
 * Rounded to two decimal places once at the end rather than per leg, so a
 * five-leg accumulator does not accumulate five roundings.
 */
export function calculateTotalOdds(
  selections: readonly { readonly odds: number }[],
): number {
  const product = selections.reduce((total, leg) => total * leg.odds, 1);

  return Math.round(product * 100) / 100;
}

/**
 * The simulated payout a winning slip would return, in minor units.
 *
 * Floored: the platform never pays a fraction of a kobo, and rounding up
 * would mean paying out money that was never staked.
 */
export function calculatePotentialPayout(
  stake: number,
  totalOdds: number,
): number {
  return Math.floor(stake * totalOdds);
}
