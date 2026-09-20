import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import type { Ticket, TicketStatus } from "@betng/contracts";
import { formatDateTime, formatMoney, formatOdds } from "@betng/ui-core";
import { DataTable, Panel, SearchInput, Select, type Column } from "@betng/ui-web";
import { Guard } from "../components/Guard";
import { PageHeader } from "../components/PageHeader";
import { TicketStatusBadge } from "../components/TicketStatusBadge";
import { useTickets } from "../hooks/queries";
import { TICKET_STATUS } from "../lib/ticket";

type StatusChoice = TicketStatus | "ALL";

const STATUS_OPTIONS: readonly { readonly value: StatusChoice; readonly label: string }[] = [
  { value: "OPEN", label: "Open" },
  { value: "WON", label: "Won (unpaid)" },
  { value: "ALL", label: "All statuses" },
  ...(["LOST", "PAID", "VOID", "CANCELLED", "EXPIRED"] as const).map((value) => ({ value, label: TICKET_STATUS[value].label })),
];

const COLUMNS: readonly Column<Ticket>[] = [
  { key: "code", header: "Ticket", cell: (t) => <span className="font-mono font-semibold">{t.code}</span>, sortValue: (t) => t.code },
  { key: "placed", header: "Placed", cell: (t) => <span className="whitespace-nowrap text-text-secondary">{formatDateTime(t.placedAt)}</span>, sortValue: (t) => t.placedAt },
  {
    key: "legs",
    header: "Selections",
    hideBelow: "lg",
    cell: (t) => (
      <span className="block max-w-72 truncate text-text-secondary">
        {t.selections.length > 1 && <span className="mr-1.5 font-semibold text-text-primary">{t.selections.length}×</span>}
        {t.selections.map((s) => s.matchLabel).join(", ")}
      </span>
    ),
  },
  { key: "customer", header: "Customer", hideBelow: "xl", cell: (t) => <span className="text-text-secondary">{t.customerName ?? "—"}</span> },
  { key: "cashier", header: "Cashier", hideBelow: "xl", cell: (t) => <span className="text-text-secondary">{t.cashierName}</span>, sortValue: (t) => t.cashierName },
  { key: "odds", header: "Odds", numeric: true, hideBelow: "md", cell: (t) => formatOdds(t.totalOdds), sortValue: (t) => t.totalOdds },
  { key: "stake", header: "Stake", numeric: true, cell: (t) => formatMoney(t.stake), sortValue: (t) => t.stake },
  { key: "return", header: "Return", numeric: true, cell: (t) => formatMoney(t.potentialPayout), sortValue: (t) => t.potentialPayout },
  { key: "status", header: "Status", cell: (t) => <TicketStatusBadge status={t.status} />, sortValue: (t) => t.status },
];

function OpenTickets(): React.JSX.Element {
  const navigate = useNavigate();
  const [status, setStatus] = useState<StatusChoice>("OPEN");
  const [q, setQ] = useState("");
  const filter = useMemo(() => ({ ...(status === "ALL" ? {} : { status }), ...(q.trim() === "" ? {} : { q: q.trim() }) }), [status, q]);
  const tickets = useTickets(filter);

  return (
    <div className="mx-auto max-w-[88rem] p-4 lg:p-5">
      <PageHeader title="Open Tickets" description="Tickets sold at this shop. Search covers ticket ID, customer name and phone." />
      <Panel flush>
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <SearchInput label="Search tickets" placeholder="Ticket ID, customer or phone" value={q} onChange={setQ} className="w-full sm:w-72" autoFocus />
          <Select label="Status" size="sm" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
          <p className="ml-auto text-sm tabular text-text-muted" aria-live="polite">
            {tickets.data === undefined ? "" : `${String(tickets.data.length)} ticket${tickets.data.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <DataTable
          caption="Tickets"
          columns={COLUMNS}
          rows={tickets.data}
          rowKey={(t) => t.code}
          loading={tickets.isPending}
          error={tickets.error}
          onRetry={() => void tickets.refetch()}
          onRowClick={(t) => void navigate(`/tickets/${t.code}`)}
          pageSize={15}
          initialSort={{ key: "placed", direction: "desc" }}
          empty={q !== "" ? { title: "No ticket matches that search", description: "Check the ticket ID. Tickets from other shops cannot be looked up here." } : { title: status === "OPEN" ? "No open tickets" : "No tickets with this status", description: "Tickets settle automatically when their matches finish." }}
        />
      </Panel>
    </div>
  );
}

export function OpenTicketsPage(): React.JSX.Element {
  return (
    <Guard permission="tickets:check">
      <OpenTickets />
    </Guard>
  );
}
