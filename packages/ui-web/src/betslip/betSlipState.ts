import { formatMoney, type BetRejectionReason, type BetView } from "@betng/ui-core";

export type BetSlipState =
  | { readonly kind: "EMPTY" }
  | { readonly kind: "SUBMITTING" }
  | { readonly kind: "ACCEPTED"; readonly bet?: BetView | undefined }
  | {
      readonly kind: "PARTIALLY_ACCEPTED";
      readonly bet?: BetView | undefined;
      readonly rejectedCount?: number | undefined;
      readonly message?: string | undefined;
    }
  | {
      readonly kind: "LIMITED";
      readonly maxStake?: number | undefined;
      readonly message?: string | undefined;
    }
  | {
      readonly kind: "REJECTED";
      readonly reason?: BetRejectionReason | undefined;
      readonly message?: string | undefined;
      readonly maxStake?: number | undefined;
    }
  | { readonly kind: "SUSPENDED"; readonly message?: string | undefined }
  | { readonly kind: "EXPIRED"; readonly message?: string | undefined }
  | { readonly kind: "ERROR"; readonly message?: string | undefined };

export const REJECTION_WORDING: Readonly<Record<BetRejectionReason, string>> = {
  MARKET_CLOSED: "This market has closed. Remove the selection to continue.",
  MARKET_SUSPENDED: "This market is suspended. Try again when it reopens.",
  ODDS_CHANGED: "The price changed before your bet was accepted. Review the new odds and submit again.",
  STAKE_LIMITED: "Your stake is above the limit for this bet.",
  RISK_REJECTED: "This bet was not accepted.",
  INSUFFICIENT_FUNDS: "Your balance does not cover this stake.",
  INVALID_BET: "This combination of selections cannot be placed.",
};

export function rejectionText(
  reason: BetRejectionReason | undefined,
  maxStake: number | undefined,
): string {
  const base =
    reason === undefined ? "This bet was not accepted." : REJECTION_WORDING[reason];

  return maxStake === undefined
    ? base
    : `${base} Maximum stake: ${formatMoney(maxStake)}.`;
}
