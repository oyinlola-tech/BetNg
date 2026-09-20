import { Check, Minus, X } from "lucide-react";
import type { Ticket, TicketSelection } from "@betng/contracts";
import { formatDateTime, formatKickoffTime, formatMoney, formatOdds } from "@betng/ui-core";
import { BrandLogo, cn } from "@betng/ui-web";
import { TICKET_STATUS } from "../lib/ticket";
import { TicketStatusBadge } from "./TicketStatusBadge";

const OUTCOME: Readonly<Record<TicketSelection["outcome"], { readonly label: string; readonly className: string; readonly icon: React.ReactNode }>> = {
  PENDING: { label: "Open", className: "text-text-muted", icon: <Minus className="size-3" aria-hidden /> },
  WON: { label: "Won", className: "text-success", icon: <Check className="size-3" strokeWidth={3} aria-hidden /> },
  LOST: { label: "Lost", className: "text-danger", icon: <X className="size-3" strokeWidth={3} aria-hidden /> },
  VOID: { label: "Void", className: "text-warning", icon: <Minus className="size-3" aria-hidden /> },
};

function Barcode({ code }: { readonly code: string }): React.JSX.Element {
  const bars = [...code.replace("-", "")].flatMap((char) => {
    const n = char.charCodeAt(0);

    return [1 + (n % 3), 1 + ((n >> 2) % 2), 1 + ((n >> 3) % 3), 1 + ((n >> 1) % 2)];
  });
  let x = 0;

  return (
    <svg viewBox={`0 0 ${String(bars.reduce((a, b) => a + b, 0))} 24`} preserveAspectRatio="none" className="h-9 w-full text-text-primary" role="img" aria-label={`Barcode for ticket ${code}`}>
      {bars.map((width, index) => {
        const rect = index % 2 === 0 ? <rect key={index} x={x} y={0} width={width} height={24} fill="currentColor" /> : null;

        x += width;

        return rect;
      })}
    </svg>
  );
}

function Row({ label, children, strong = false }: { readonly label: string; readonly children: React.ReactNode; readonly strong?: boolean }): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-text-secondary">{label}</dt>
      <dd className={cn("text-right tabular", strong ? "font-display text-lg font-semibold" : "font-medium")}>{children}</dd>
    </div>
  );
}

export function TicketReceipt({ ticket, className }: { readonly ticket: Ticket; readonly className?: string }): React.JSX.Element {
  const meta = TICKET_STATUS[ticket.status];

  return (
    <article data-print="ticket" aria-label={`Ticket ${ticket.code}`} className={cn("w-full max-w-sm rounded-md border border-border bg-surface text-base shadow-sm", className)}>
      <header className="flex items-center justify-between px-5 pt-5">
        <BrandLogo size={26} />
        <TicketStatusBadge status={ticket.status} size="md" solid={ticket.status === "WON"} />
      </header>

      <div className="px-5 pt-4">
        <p className="caps-label">Ticket ID</p>
        <p className="font-mono text-2xl font-semibold tracking-wider text-text-primary">{ticket.code}</p>
        <p className="mt-0.5 text-sm text-text-muted">{meta.description}</p>
      </div>

      <dl className="mt-4 space-y-1 border-y border-dashed border-border-strong px-5 py-3 text-sm">
        <Row label="Shop">{ticket.shopCode}</Row>
        <Row label="Cashier">{ticket.cashierName}</Row>
        <Row label="Placed">{formatDateTime(ticket.placedAt)}</Row>
        {ticket.customerName !== undefined && <Row label="Customer">{ticket.customerName}</Row>}
        {ticket.customerPhone !== undefined && <Row label="Phone">{ticket.customerPhone}</Row>}
      </dl>

      <ol className="divide-y divide-border px-5">
        {ticket.selections.map((leg, index) => {
          const outcome = OUTCOME[leg.outcome];

          return (
            <li key={leg.selectionId} className="py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-text-muted">
                    {String(index + 1).padStart(2, "0")} · {leg.leagueName} · {formatKickoffTime(leg.kickoffAt)}
                  </p>
                  <p className="truncate font-semibold text-text-primary">{leg.matchLabel}</p>
                  <p className="truncate text-sm text-text-secondary">
                    {leg.marketLabel}: <span className="font-medium text-text-primary">{leg.selectionLabel}</span>
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display font-semibold tabular">{formatOdds(leg.odds)}</p>
                  <p className={cn("inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-caps", outcome.className)}>
                    {outcome.icon}
                    {outcome.label}
                    {leg.result !== undefined && leg.outcome !== "VOID" && <span className="font-medium normal-case tracking-normal text-text-muted">({leg.result})</span>}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <dl className="space-y-1 border-t border-dashed border-border-strong px-5 py-3">
        <Row label={`Total odds (${String(ticket.selections.length)})`}>{formatOdds(ticket.totalOdds)}</Row>
        <Row label="Stake">{formatMoney(ticket.stake)}</Row>
        <Row label="Potential return" strong={ticket.payout === undefined}>
          {formatMoney(ticket.potentialPayout)}
        </Row>
        {ticket.payout !== undefined && (
          <Row label={ticket.status === "PAID" ? "Paid out" : ticket.status === "VOID" ? "Refund due" : "Payout"} strong>
            {formatMoney(ticket.payout)}
          </Row>
        )}
        {ticket.paidAt !== undefined && <Row label="Paid at">{formatDateTime(ticket.paidAt)}</Row>}
      </dl>

      <footer className="px-5 pb-5">
        <Barcode code={ticket.code} />
        <p className="mt-2 text-center text-xs text-text-muted">
          Collect by {formatDateTime(ticket.expiresAt)}. Simulated ticket: play money only, no cash value.
        </p>
      </footer>
    </article>
  );
}
