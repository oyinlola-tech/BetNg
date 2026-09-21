import {
  formatDateTime,
  formatMoney,
  formatOdds,
  type BetView,
} from "@betng/ui-core";
import { cn } from "../lib/cn";

export interface BetReceiptProps {
  readonly bet: BetView;
  readonly showLegs?: boolean;
  readonly className?: string | undefined;
}

export function BetReceipt({
  bet,
  showLegs = true,
  className,
}: BetReceiptProps): React.JSX.Element {
  const reference = bet.reference ?? bet.id;

  return (
    <section
      aria-label={`Bet receipt ${reference}`}
      className={cn("rounded-sm bg-surface-sunken p-3", className)}
    >
      <p className="type-caption">Reference</p>
      <p className="type-data break-all font-mono text-text-primary">
        {reference}
      </p>
      {showLegs && bet.legs.length > 0 && (
        <ul className="mt-3 divide-y divide-border border-y border-border">
          {bet.legs.map((leg) => (
            <li key={leg.selectionId} className="flex items-start gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="type-small truncate text-text-muted">
                  {leg.matchLabel}
                </p>
                <p className="type-body truncate font-semibold text-text-primary">
                  {leg.selectionLabel}
                </p>
                <p className="type-small truncate text-text-secondary">
                  {leg.marketName}
                </p>
              </div>
              <span className="type-odds shrink-0 text-text-primary">
                {formatOdds(leg.odds)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <dl className="mt-3 space-y-1.5">
        <Line label="Stake" value={formatMoney(bet.stake)} />
        <Line label="Odds" value={formatOdds(bet.totalOdds)} />
        <Line
          label="Potential payout"
          value={formatMoney(bet.potentialPayout)}
          strong
        />
        {bet.payout !== undefined && (
          <Line label="Paid out" value={formatMoney(bet.payout)} strong />
        )}
        <Line label="Placed" value={formatDateTime(bet.placedAt)} />
      </dl>
    </section>
  );
}

function Line({
  label,
  value,
  strong = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly strong?: boolean;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="type-small text-text-secondary">{label}</dt>
      <dd
        className={cn(
          strong ? "type-financial" : "type-data",
          "text-right text-text-primary",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
