import { Link } from "react-router";
import { QrCode } from "lucide-react";
import {
  formatDateTime,
  formatMoney,
  formatOdds,
  type BetView,
} from "@betng/ui-core";
import { StatusBadge, cn } from "@betng/ui-web";

export function ticketLabel(bet: BetView): string {
  return bet.legs.length === 1 ? "Single" : `${String(bet.legs.length)}-fold`;
}

/** The figure a ticket leads with: what was paid once the platform reports it, otherwise what it could pay. */
export function ticketReturn(bet: BetView): { readonly label: string; readonly amount: number } {
  return bet.payout === undefined
    ? { label: "Potential payout", amount: bet.potentialPayout }
    : { label: "Paid out", amount: bet.payout };
}

export function TicketSummary({ bet }: { readonly bet: BetView }): React.JSX.Element {
  const first = bet.legs[0];
  const more = bet.legs.length - 1;

  return (
    <div className="min-w-0">
      <p className="type-body truncate font-semibold text-text-primary">
        {first === undefined ? ticketLabel(bet) : first.selectionLabel}
        {more > 0 && <span className="font-normal text-text-muted"> +{more} more</span>}
      </p>
      {first !== undefined && (
        <p className="type-small truncate text-text-secondary">
          {first.matchLabel} · {first.marketName}
        </p>
      )}
    </div>
  );
}

export function TicketCard({ bet }: { readonly bet: BetView }): React.JSX.Element {
  const figure = ticketReturn(bet);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <StatusBadge status={bet.status} />
        <span className="type-small text-text-muted">{formatDateTime(bet.placedAt)}</span>
      </div>
      <TicketSummary bet={bet} />
      <dl className="grid grid-cols-[1fr_auto_auto] gap-x-5 gap-y-2 border-t border-border pt-2">
        <div>
          <dt className="type-caption">Stake</dt>
          <dd className="type-financial text-left">{formatMoney(bet.stake)}</dd>
        </div>
        <div>
          <dt className="type-caption">Odds</dt>
          <dd className="type-data">{formatOdds(bet.totalOdds)}</dd>
        </div>
        <div className="text-right">
          <dt className="type-caption">{figure.label}</dt>
          <dd className="type-financial">{formatMoney(figure.amount)}</dd>
        </div>
      </dl>
    </div>
  );
}

/** Shown only for a reference the platform issued. The scannable code itself comes from the platform when it supplies one. */
export function TicketCodePlaceholder({
  reference,
  className,
}: {
  readonly reference: string;
  readonly className?: string;
}): React.JSX.Element {
  return (
    <figure
      aria-label={`Ticket code for reference ${reference}`}
      className={cn("flex items-center gap-3 rounded-sm border border-dashed border-border-strong p-3", className)}
    >
      <span className="flex size-14 shrink-0 items-center justify-center rounded-sm bg-surface-sunken text-text-muted">
        <QrCode className="size-8" aria-hidden />
      </span>
      <figcaption className="min-w-0">
        <p className="type-caption">Ticket code</p>
        <p className="type-data break-all font-mono text-text-primary">{reference}</p>
        <p className="type-small text-text-muted">A scannable code appears here when the platform issues one.</p>
      </figcaption>
    </figure>
  );
}

export function TicketLink({ bet, children }: { readonly bet: BetView; readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <Link to={`/tickets/${bet.id}`} className="rounded-xs font-semibold text-brand hover:underline focus-ring">
      {children}
    </Link>
  );
}
