import { Info } from "lucide-react";
import {
  formatMoney,
  formatOdds,
  type BetView,
  type SlipTotals,
} from "@betng/ui-core";
import { cn } from "../lib/cn";
import { Tooltip } from "../ui";

const ESTIMATE_NOTE =
  "An estimate from the prices on your slip. The accepted bet carries the platform's figure.";

export interface BetSlipSummaryProps {
  readonly totals: SlipTotals;
  /** The accepted bet. Once present, the platform's own figures replace the estimate. */
  readonly accepted?:
    | Pick<BetView, "potentialPayout" | "stake" | "totalOdds">
    | undefined;
  readonly className?: string | undefined;
}

export function BetSlipSummary({
  totals,
  accepted,
  className,
}: BetSlipSummaryProps): React.JSX.Element {
  const stake = accepted?.stake ?? totals.stake;
  const odds = accepted?.totalOdds ?? totals.totalOdds;

  return (
    <dl className={cn("space-y-1.5", className)}>
      <Line label="Selections" value={String(totals.selectionCount)} />
      <Line
        label={accepted === undefined ? "Combined odds" : "Accepted odds"}
        value={odds > 0 ? formatOdds(odds) : "–"}
      />
      <Line label="Stake" value={formatMoney(stake)} />
      <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
        <dt className="type-body flex items-center gap-1 font-semibold text-text-primary">
          {accepted === undefined ? "Estimated return" : "Potential payout"}
          {accepted === undefined && (
            <Tooltip content={ESTIMATE_NOTE}>
              <button
                type="button"
                aria-label="About the estimated return"
                className="flex size-5 items-center justify-center rounded-xs text-text-muted focus-ring"
              >
                <Info className="size-3.5" aria-hidden />
              </button>
            </Tooltip>
          )}
        </dt>
        <dd className="type-financial text-right text-text-primary">
          {formatMoney(accepted?.potentialPayout ?? totals.potentialReturn)}
        </dd>
      </div>
      {accepted === undefined && (
        <p className="type-small text-text-muted">{ESTIMATE_NOTE}</p>
      )}
    </dl>
  );
}

function Line({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="type-small text-text-secondary">{label}</dt>
      <dd className="type-data text-text-primary">{value}</dd>
    </div>
  );
}
