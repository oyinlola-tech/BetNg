import { Link, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { DataSourceError, formatDateTime, formatMoney, formatOdds, type BetView } from "@betng/ui-core";
import { Card, NotFoundState, PageSkeleton, SectionHeading, StatusBadge, statusTone } from "@betng/ui-web";
import { AccountErrorState } from "../features/auth";
import { usePageMeta } from "../features/seo";
import { TicketCodePlaceholder, ticketLabel } from "../features/tickets/TicketParts";
import { useAccountSignals, useBet } from "../hooks/accountQueries";

function Fact({ label, children, financial = false }: { readonly label: string; readonly children: React.ReactNode; readonly financial?: boolean }): React.JSX.Element {
  return (
    <div>
      <dt className="type-caption">{label}</dt>
      <dd className={financial ? "type-financial mt-0.5 text-left text-text-primary" : "type-data mt-0.5 text-text-primary"}>{children}</dd>
    </div>
  );
}

function TicketDetail({ bet }: { readonly bet: BetView }): React.JSX.Element {
  const settled = bet.settledAt !== undefined;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card padding="none" className="min-w-0">
        <div className="border-b border-border px-4 py-3">
          <SectionHeading as="h2">Selections</SectionHeading>
        </div>
        <ul className="divide-y divide-border">
          {bet.legs.map((leg) => (
            <li key={leg.selectionId} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="type-small truncate text-text-muted">{leg.leagueCode}</p>
                <Link to={`/matches/${leg.matchId}`} className="type-body block truncate rounded-xs font-semibold text-text-primary hover:text-brand focus-ring">
                  {leg.matchLabel}
                </Link>
                <p className="type-small text-text-secondary">
                  {leg.marketName} · <span className="font-semibold text-text-primary">{leg.selectionLabel}</span>
                </p>
                {leg.result !== undefined && <p className="type-small mt-0.5 text-text-muted">Result: {leg.result}</p>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="type-odds text-text-primary">{formatOdds(leg.odds)}</span>
                <StatusBadge status={leg.outcome} />
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <div className="space-y-4">
        <Card>
          <div className="flex items-center justify-between gap-2">
            <SectionHeading as="h2">Ticket</SectionHeading>
            <StatusBadge status={bet.status} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
            <Fact label="Stake" financial>
              {formatMoney(bet.stake)}
            </Fact>
            <Fact label="Odds">{formatOdds(bet.totalOdds)}</Fact>
            <Fact label="Potential payout" financial>
              {formatMoney(bet.potentialPayout)}
            </Fact>
            <Fact label="Payout" financial>
              {bet.payout === undefined ? "Not paid" : formatMoney(bet.payout)}
            </Fact>
            <Fact label="Result">{bet.status === "PENDING" ? "Awaiting results" : statusTone(bet.status).label}</Fact>
            <Fact label="Settlement">{settled ? "Settled" : "Not settled"}</Fact>
            <Fact label="Placed">{formatDateTime(bet.placedAt)}</Fact>
            {bet.settledAt !== undefined && <Fact label="Settled at">{formatDateTime(bet.settledAt)}</Fact>}
          </dl>
        </Card>
        <Card>
          <SectionHeading as="h2">Reference</SectionHeading>
          {bet.reference === undefined ? (
            <p className="type-small mt-3 text-text-muted">The platform has not issued a ticket reference for this bet.</p>
          ) : (
            <TicketCodePlaceholder reference={bet.reference} className="mt-3" />
          )}
          <dl className="mt-3">
            <Fact label="Bet ID">
              <span className="break-all font-mono">{bet.id}</span>
            </Fact>
          </dl>
        </Card>
      </div>
    </div>
  );
}

export function TicketPage(): React.JSX.Element {
  const { betId } = useParams();
  const bet = useBet(betId);

  usePageMeta({ title: "Ticket", noindex: true });
  useAccountSignals();

  const missing = bet.error instanceof DataSourceError && bet.error.code === "NOT_FOUND";

  return (
    <div className="space-y-5">
      <Link to="/tickets" className="type-small inline-flex items-center gap-1.5 rounded-xs font-semibold text-text-secondary hover:text-text-primary focus-ring">
        <ArrowLeft className="size-3.5" aria-hidden />
        My tickets
      </Link>
      <h1 className="type-h1">{bet.data === undefined ? "Ticket" : `${ticketLabel(bet.data)} ticket`}</h1>
      {bet.data !== undefined ? (
        <TicketDetail bet={bet.data} />
      ) : missing ? (
        <Card padding="none">
          <NotFoundState
            title="Ticket not found"
            description="This ticket does not exist on your account."
            action={
              <Link to="/tickets" className="rounded-xs text-sm font-semibold text-brand hover:underline focus-ring">
                Back to my tickets
              </Link>
            }
          />
        </Card>
      ) : bet.isError ? (
        <Card padding="none">
          <AccountErrorState error={bet.error} onRetry={() => void bet.refetch()} />
        </Card>
      ) : (
        <PageSkeleton />
      )}
    </div>
  );
}
