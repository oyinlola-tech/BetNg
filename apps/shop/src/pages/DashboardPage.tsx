import { LiveMinute } from "../components/LiveMinute";
import { Link, useNavigate } from "react-router";
import { CalendarCheck, FilePlus2, HandCoins, Radio, ScanLine } from "lucide-react";
import type { Ticket } from "@betng/contracts";
import { formatMoney, formatRelative, formatSignedMoney, toLocalDateKey } from "@betng/ui-core";
import { DataTable, EmptyState, ErrorState, KpiCard, Panel, Skeleton, TeamBadge, cn, type Column } from "@betng/ui-web";
import { Kbd } from "../components/Kbd";
import { PageHeader } from "../components/PageHeader";
import { TicketStatusBadge } from "../components/TicketStatusBadge";
import { useDailyReport, useMatches, useTickets } from "../hooks/queries";
import { useShopSession } from "../hooks/useShopSession";
import { localDateKey } from "../lib/ticket";

const ACTIONS = [
  { to: "/tickets/new", label: "New Bet", hint: "Open the betting terminal", icon: FilePlus2, key: "F2", permission: "tickets:sell", primary: true },
  { to: "/tickets/check", label: "Check Ticket", hint: "Scan or type a ticket ID", icon: ScanLine, key: "F3", permission: "tickets:check", primary: false },
  { to: "/cashier/payout", label: "Payout", hint: "Pay a winning ticket", icon: HandCoins, key: "F4", permission: "tickets:payout", primary: false },
  { to: "/tickets/results", label: "Results", hint: "Finished matches", icon: CalendarCheck, key: "F6", permission: undefined, primary: false },
] as const;

const COLUMNS: readonly Column<Ticket>[] = [
  { key: "code", header: "Ticket", cell: (t) => <span className="font-mono font-semibold">{t.code}</span> },
  { key: "legs", header: "Selections", cell: (t) => <span className="text-text-secondary">{t.selections.length === 1 ? (t.selections[0]?.matchLabel ?? "") : `${String(t.selections.length)} selections`}</span>, hideBelow: "md" },
  { key: "stake", header: "Stake", numeric: true, cell: (t) => formatMoney(t.stake) },
  { key: "return", header: "Return", numeric: true, cell: (t) => formatMoney(t.potentialPayout), hideBelow: "lg" },
  { key: "status", header: "Status", cell: (t) => <TicketStatusBadge status={t.status} /> },
  { key: "when", header: "Placed", align: "right", cell: (t) => <span className="text-sm text-text-muted">{formatRelative(t.placedAt)}</span>, hideBelow: "md" },
];

function LiveStrip(): React.JSX.Element {
  const live = useMatches({ phases: ["LIVE", "HALFTIME"] });

  if (live.isPending) return <Skeleton className="h-16" />;
  if (live.isError) return <ErrorState compact error={live.error} onRetry={() => void live.refetch()} />;
  if (live.data.length === 0) return <EmptyState compact icon={<Radio className="size-5" />} title="Nothing in play" description="The next round kicks off within a few minutes." />;

  return (
    <ul className="flex gap-2 overflow-x-auto p-3 scrollbar-thin">
      {live.data.map((m) => (
        <li key={m.id} className="w-52 shrink-0 rounded-sm border border-border bg-surface-sunken/50 px-3 py-2">
          <p className="mb-1 flex items-center justify-between text-xs">
            <span className="truncate font-semibold text-text-muted">{m.leagueCode}</span>
            <span className="flex items-center gap-1 font-semibold tabular text-live">
              <span className="size-1.5 rounded-full bg-live animate-pulse-live" aria-hidden />
              {m.phase === "HALFTIME" ? "HT" : <LiveMinute clock={m.clock} />}
            </span>
          </p>
          {([m.home, m.away] as const).map((team, i) => (
            <p key={team.id} className="flex items-center gap-2 text-base">
              <TeamBadge team={team} size="xs" />
              <span className="truncate font-medium">{team.shortName}</span>
              <span className="ml-auto font-display font-semibold tabular">{i === 0 ? m.score.home : m.score.away}</span>
            </p>
          ))}
        </li>
      ))}
    </ul>
  );
}

export function DashboardPage(): React.JSX.Element {
  const { session, can } = useShopSession();
  const navigate = useNavigate();
  const canReport = can("reports:read");
  const report = useDailyReport(undefined, canReport);
  const yesterday = useDailyReport(localDateKey(-1), canReport);
  const tickets = useTickets({}, can("tickets:check"));
  const open = tickets.data?.filter((t) => t.status === "OPEN").length;
  const toCollect = tickets.data?.filter((t) => t.status === "WON");
  const today = localDateKey();
  const mine = tickets.data?.filter((t) => t.cashierId === session?.cashier.id && t.status !== "CANCELLED" && toLocalDateKey(new Date(t.placedAt)) === today);
  const delta = (today: number | undefined, before: number | undefined): number | undefined => (today === undefined || before === undefined || before === 0 ? undefined : (today - before) / before);

  return (
    <div className="mx-auto max-w-[88rem] p-4 lg:p-5">
      <PageHeader title={`Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, ${session?.cashier.displayName.split(" ")[0] ?? ""}`} description="Today at the counter. Figures are simulated." />

      <section aria-label="Quick actions" className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ACTIONS.filter((a) => a.permission === undefined || can(a.permission)).map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className={cn(
              "group flex items-center gap-3 rounded-md border px-4 py-3.5 transition-colors focus-ring",
              action.primary ? "border-brand bg-brand text-text-on-brand hover:bg-brand-hover" : "border-border bg-surface hover:border-border-strong hover:bg-surface-hover",
            )}
          >
            <action.icon className={cn("size-5 shrink-0", !action.primary && "text-text-muted")} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-md font-semibold">{action.label}</span>
              <span className={cn("block truncate text-sm", action.primary ? "text-text-on-brand" : "text-text-muted")}>{action.hint}</span>
            </span>
            <Kbd className={action.primary ? "border-white/30 bg-white/15 text-text-on-brand" : undefined}>{action.key}</Kbd>
          </Link>
        ))}
      </section>

      <section aria-label="Today" className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {canReport ? (
          <>
            <KpiCard label="Today's sales" value={report.data === undefined ? undefined : formatMoney(report.data.sales)} delta={delta(report.data?.sales, yesterday.data?.sales)} hint={report.data === undefined ? "" : `${String(report.data.ticketsSold)} tickets · vs yesterday`} />
            <KpiCard label="Today's payouts" value={report.data === undefined ? undefined : formatMoney(report.data.payouts)} delta={delta(report.data?.payouts, yesterday.data?.payouts)} positiveIsGood={false} hint="vs yesterday" />
            <KpiCard label="Net position" value={report.data === undefined ? undefined : formatSignedMoney(report.data.net)} hint="Sales less payouts" emphasis />
          </>
        ) : (
          <>
            <KpiCard label="My tickets today" value={mine === undefined ? undefined : String(mine.length)} hint="Sold under your sign-in" />
            <KpiCard label="My sales today" value={mine === undefined ? undefined : formatMoney(mine.reduce((a, t) => a + t.stake, 0))} hint="Shop totals are for managers" />
            <KpiCard label="Awaiting collection" value={toCollect === undefined ? undefined : formatMoney(toCollect.reduce((a, t) => a + (t.payout ?? t.potentialPayout), 0))} hint={toCollect === undefined ? "" : `${String(toCollect.length)} winning tickets`} emphasis />
          </>
        )}
        <KpiCard label="Open tickets" value={open === undefined ? undefined : String(open)} hint={!canReport ? "Not yet settled" : toCollect === undefined ? "" : `${String(toCollect.length)} won, awaiting collection`} />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <Panel title="Live matches" flush actions={<Link to="/betting/live" className="rounded-xs text-sm font-medium text-brand hover:underline focus-ring">Open live</Link>}>
            <LiveStrip />
          </Panel>
          <Panel title="Recent tickets" flush actions={<Link to="/tickets/open" className="rounded-xs text-sm font-medium text-brand hover:underline focus-ring">All tickets</Link>}>
            <DataTable
              caption="Recent tickets"
              columns={COLUMNS}
              rows={tickets.data?.slice(0, 8)}
              rowKey={(t) => t.code}
              loading={tickets.isPending}
              error={tickets.error}
              onRetry={() => void tickets.refetch()}
              onRowClick={(t) => void navigate(`/tickets/${t.code}`)}
              empty={{ title: "No tickets yet today", description: "Tickets sold at this counter appear here." }}
            />
          </Panel>
        </div>

        <Panel title="Awaiting collection" description="Won tickets that have not been paid" flush>
          {toCollect === undefined ? (
            <Skeleton className="m-3 h-24" />
          ) : toCollect.length === 0 ? (
            <EmptyState compact title="Nothing to pay out" description="Winning tickets appear here until the customer collects." />
          ) : (
            <ul className="divide-y divide-border">
              {toCollect.slice(0, 8).map((t) => (
                <li key={t.code}>
                  <Link to={`/cashier/payout?code=${t.code}`} className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-surface-hover focus-ring">
                    <span className="min-w-0">
                      <span className="block font-mono text-base font-semibold">{t.code}</span>
                      <span className="block truncate text-sm text-text-muted">{t.customerName ?? "Walk-in customer"}</span>
                    </span>
                    <span className="font-display text-md font-semibold tabular text-success">{formatMoney(t.payout ?? t.potentialPayout)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
