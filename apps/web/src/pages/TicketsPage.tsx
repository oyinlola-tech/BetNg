import { useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import type { BetStatus } from "@betng/contracts";
import { formatDateTime, formatMoney, formatOdds, type BetView } from "@betng/ui-core";
import { Card, DataTable, EmptyState, SectionHeader, StatusBadge, Tabs, type Column } from "@betng/ui-web";
import { AccountErrorState } from "../features/auth";
import { usePageMeta } from "../features/seo";
import { LiveBets } from "../features/tickets/LiveBets";
import { TicketCard, TicketSummary, ticketReturn } from "../features/tickets/TicketParts";
import { useAccountSignals, useBets } from "../hooks/accountQueries";

type StatusFilter = "ALL" | BetStatus;

const FILTERS: readonly { readonly value: StatusFilter; readonly label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Open" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
  { value: "VOID", label: "Void" },
  { value: "CANCELLED", label: "Cancelled" },
];

function readFilter(raw: string | null): StatusFilter {
  const value = raw?.toUpperCase();

  return FILTERS.find((f) => f.value === value)?.value ?? "ALL";
}

const COLUMNS: readonly Column<BetView>[] = [
  { key: "placedAt", header: "Placed", cell: (bet) => <span className="type-small whitespace-nowrap text-text-secondary">{formatDateTime(bet.placedAt)}</span>, sortValue: (bet) => bet.placedAt },
  { key: "ticket", header: "Ticket", cell: (bet) => <span title={bet.reference ?? bet.id} className="type-small block max-w-36 truncate font-mono text-text-secondary">{bet.reference ?? bet.id}</span>, hideBelow: "lg" },
  { key: "selections", header: "Selections", cell: (bet) => <TicketSummary bet={bet} />, hideable: false },
  { key: "odds", header: "Odds", numeric: true, cell: (bet) => <span className="type-data">{formatOdds(bet.totalOdds)}</span>, sortValue: (bet) => bet.totalOdds, hideBelow: "lg" },
  { key: "stake", header: "Stake", numeric: true, cell: (bet) => <span className="type-financial">{formatMoney(bet.stake)}</span>, sortValue: (bet) => bet.stake },
  {
    key: "return",
    header: "Payout",
    numeric: true,
    cell: (bet) => {
      const figure = ticketReturn(bet);

      return (
        <span className="type-financial">
          {formatMoney(figure.amount)}
          <span className="type-small block font-normal text-text-muted">{figure.label}</span>
        </span>
      );
    },
  },
  { key: "status", header: "Status", cell: (bet) => <StatusBadge status={bet.status} />, sortValue: (bet) => bet.status },
];

export function TicketsPage(): React.JSX.Element {
  usePageMeta({ title: "My tickets", noindex: true });
  useAccountSignals();

  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filter = readFilter(params.get("status"));
  const bets = useBets();

  const rows = useMemo(
    () => (filter === "ALL" ? bets.data : bets.data?.filter((bet) => bet.status === filter)),
    [bets.data, filter],
  );

  return (
    <div className="space-y-5">
      <SectionHeader as="h1" eyebrow="Your bets" title="My tickets" />
      <LiveBets bets={bets.data} />
      <Tabs
        label="Ticket status"
        scrollable
        value={filter}
        onChange={(next) => {
          setParams(next === "ALL" ? {} : { status: next.toLowerCase() }, { replace: true });
        }}
        items={FILTERS.map((f) => ({
          value: f.value,
          label: f.label,
          ...(bets.data === undefined
            ? {}
            : { count: f.value === "ALL" ? bets.data.length : bets.data.filter((bet) => bet.status === f.value).length }),
        }))}
      />
      <Card padding="none">
        {bets.isError && bets.data === undefined ? (
          <AccountErrorState error={bets.error} onRetry={() => void bets.refetch()} />
        ) : rows !== undefined && rows.length === 0 ? (
          <EmptyState
            preset="emptyBetslip"
            title={filter === "ALL" ? "No tickets yet" : "No tickets with this status"}
            description={
              filter === "ALL"
                ? "Bets you place are listed here and update as the platform settles them."
                : "Choose another status to see the rest of your tickets."
            }
            action={
              filter === "ALL" ? (
                <Link to="/" className="rounded-xs text-sm font-semibold text-brand hover:underline focus-ring">
                  Browse matches
                </Link>
              ) : undefined
            }
          />
        ) : (
          <DataTable
            caption="Your tickets"
            columns={COLUMNS}
            rows={rows}
            rowKey={(bet) => bet.id}
            loading={bets.isPending}
            density="comfortable"
            pageSize={20}
            initialSort={{ key: "placedAt", direction: "desc" }}
            onRowClick={(bet) => {
              void navigate(`/tickets/${bet.id}`);
            }}
            renderCard={(bet) => <TicketCard bet={bet} />}
          />
        )}
      </Card>
    </div>
  );
}
