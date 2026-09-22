import { useMemo } from "react";
import { useSearchParams } from "react-router";
import type { AnalyticsBreakdownRow, AnalyticsDimension, SessionAnalysis } from "@betng/contracts";
import { formatMoney, formatMoneyCompact, localDayRange } from "@betng/ui-core";
import { BarChart, DataTable, Drawer, Input, Panel, RankedBars, SectionHeading, Select, Tabs, TimeSeriesChart, Tooltip, cn, emptyPresets, type Column } from "@betng/ui-web";
import { AccountAnalysisPanel } from "../components/AccountAnalysisPanel";
import { SignedMoney } from "../components/Bits";
import { ChartPanel } from "../components/ChartPanel";
import { ExportControl } from "../components/ExportControl";
import { MetricCard, metricFrom } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { useAccountAnalysis, useAnalyticsBreakdown, useAnalyticsOverview, useAnalyticsSessions, useLeagues, useShopDirectory, type AnalyticsWindow } from "../hooks/queries";
import { useAdmin } from "../hooks/useAdmin";
import { downloadCsv } from "../lib/csv";
import { dayKey, formatCount, formatMoneyAxis, formatPercent } from "../lib/format";

type WindowKey = "today" | "7d" | "30d" | "all" | "custom";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[0-9a-f-]{36}$/i;

const WINDOWS: readonly { readonly value: WindowKey; readonly label: string; readonly days?: number }[] = [
  { value: "today", label: "Today", days: 1 },
  { value: "7d", label: "7 days", days: 7 },
  { value: "30d", label: "30 days", days: 30 },
  { value: "all", label: "All time" },
];

/* What the dashboard brief asks for, mapped to the dimensions the analytics contract has. */
const DIMENSIONS: readonly { readonly label: string; readonly by?: AnalyticsDimension }[] = [
  { label: "League", by: "league" },
  { label: "Match", by: "match" },
  { label: "Market", by: "market" },
  { label: "Selection", by: "selection" },
  { label: "Shop", by: "shop" },
  { label: "Cashier", by: "cashier" },
  { label: "Account", by: "customer" },
  { label: "Channel", by: "channel" },
  { label: "Date", by: "day" },
  { label: "Hour", by: "hour" },
  { label: "Status" },
];

const SESSION_KINDS: readonly { readonly value: SessionAnalysis["kind"]; readonly label: string }[] = [
  { value: "MATCHDAY", label: "By matchday" },
  { value: "ROUND", label: "By round" },
  { value: "DAY", label: "By day" },
  { value: "HOUR", label: "By hour" },
];

const ACCOUNT_KIND: Readonly<Partial<Record<AnalyticsDimension, "accounts" | "shops" | "cashiers">>> = { customer: "accounts", shop: "shops", cashier: "cashiers" };

const CHART_ROWS = 10;

function windowFor(key: WindowKey, from: string, to: string): AnalyticsWindow {
  if (key === "custom") return { ...(from === "" ? {} : { from: localDayRange(from).from }), ...(to === "" ? {} : { to: localDayRange(to).to }) };

  const days = WINDOWS.find((w) => w.value === key)?.days;

  return days === undefined ? {} : { from: localDayRange(dayKey(days - 1)).from };
}

const param = (params: URLSearchParams, key: string, pattern: RegExp): string => {
  const value = params.get(key) ?? "";

  return pattern.test(value) ? value : "";
};

export function ReportsPage(): React.JSX.Element {
  const [params, setParams] = useSearchParams();
  const { can } = useAdmin();
  const from = param(params, "from", DAY);
  const to = param(params, "to", DAY);
  const leagueId = param(params, "league", ID);
  const shopId = param(params, "shop", ID);
  const windowKey: WindowKey = from !== "" || to !== "" ? "custom" : (WINDOWS.find((w) => w.value === params.get("window"))?.value ?? "7d");
  const by: AnalyticsDimension = DIMENSIONS.find((d) => d.by !== undefined && d.by === params.get("by"))?.by ?? "league";
  const sessionKind = SESSION_KINDS.find((k) => k.value === params.get("sessions"))?.value ?? "MATCHDAY";
  const subject = params.get("subject") ?? undefined;
  const dimensionLabel = DIMENSIONS.find((d) => d.by === by)?.label ?? by;
  const timeDimension = by === "day" || by === "hour";

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const window = useMemo(() => windowFor(windowKey, from, to), [windowKey, from, to, dayKey(0)]);
  const overview = useAnalyticsOverview(window);
  const breakdown = useAnalyticsBreakdown(by, window, 100, { ...(leagueId === "" ? {} : { leagueId }), ...(shopId === "" ? {} : { shopId }) });
  const sessions = useAnalyticsSessions(sessionKind, window, leagueId === "" ? undefined : leagueId);
  const leagues = useLeagues();
  const shops = useShopDirectory(can("shops:read"));
  const accountKind = ACCOUNT_KIND[by];
  const account = useAccountAnalysis(subject === undefined ? undefined : accountKind, subject, window);

  const set = (key: string, value: string | undefined): void => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);

        if (value === undefined || value === "") next.delete(key);
        else next.set(key, value);
        if (key === "by") next.delete("subject");
        if (key === "window") {
          next.delete("from");
          next.delete("to");
        }

        return next;
      },
      { replace: true },
    );
  };

  const o = overview.data;
  const rows = breakdown.data?.items ?? [];
  const charted = rows.slice(0, CHART_ROWS);
  const sessionRows = sessions.data ?? [];
  const selectable = accountKind !== undefined;

  const columns: readonly Column<AnalyticsBreakdownRow>[] = [
    { key: "label", header: dimensionLabel, hideable: false, cell: (r) => <span className="block min-w-40 font-medium">{r.label}</span> },
    { key: "bets", header: "Bets", numeric: true, cell: (r) => formatCount(r.bets) },
    { key: "pendingBets", header: "Pending", numeric: true, cell: (r) => formatCount(r.pendingBets), hideBelow: "xl" },
    { key: "winningBets", header: "Won", numeric: true, cell: (r) => formatCount(r.winningBets), hideBelow: "xl" },
    { key: "losingBets", header: "Lost", numeric: true, cell: (r) => formatCount(r.losingBets), hideBelow: "xl" },
    { key: "voidBets", header: "Void", numeric: true, cell: (r) => formatCount(r.voidBets), hideBelow: "xl", defaultHidden: true },
    { key: "stake", header: "Stake", numeric: true, cell: (r) => formatMoney(r.stake) },
    { key: "payout", header: "Payout", numeric: true, cell: (r) => formatMoney(r.payout), hideBelow: "lg" },
    { key: "pendingLiability", header: "Exposure", numeric: true, cell: (r) => formatMoney(r.pendingLiability), hideBelow: "lg" },
    { key: "operatorResult", header: "Operator result", numeric: true, cell: (r) => <SignedMoney value={r.operatorResult} className="type-financial" /> },
    { key: "operatorResultRate", header: "Rate", numeric: true, cell: (r) => formatPercent(r.operatorResultRate), hideBelow: "lg" },
  ];

  const exportCsv = (): void => {
    downloadCsv(
      `betng-report-${by}-${windowKey === "custom" ? `${from || "start"}_${to || "now"}` : windowKey}-${dayKey(0)}.csv`,
      [by, "label", "bets", "pending_bets", "winning_bets", "losing_bets", "void_bets", "stake_minor", "payout_minor", "exposure_minor", "operator_result_minor", "operator_result_rate"],
      rows.map((r) => [r.key, r.label, r.bets, r.pendingBets, r.winningBets, r.losingBets, r.voidBets, r.stake, r.payout, r.pendingLiability, r.operatorResult, r.operatorResultRate]),
    );
  };

  const MainChart = timeDimension ? TimeSeriesChart : BarChart;

  return (
    <>
      <PageHeader
        title="Reports"
        description="Analytics over every accepted bet, computed by the platform. Charts and tables show the same figures; filters are part of the address."
        actions={
          <>
            <Tabs<WindowKey>
              label="Reporting window"
              variant="segmented"
              value={windowKey}
              onChange={(next) => set("window", next === "7d" ? undefined : next)}
              items={[...WINDOWS.map((w) => ({ value: w.value, label: w.label })), ...(windowKey === "custom" ? [{ value: "custom" as const, label: "Custom" }] : [])]}
            />
            <ExportControl scope="this breakdown" rowCount={rows.length} onExport={exportCsv} />
          </>
        }
      />
      <div role="group" aria-label="Report filters" className="mb-5 flex flex-wrap items-end gap-2">
        <Input aria-label="From date" type="date" value={from} {...(to === "" ? {} : { max: to })} onChange={(event) => set("from", event.target.value)} className="w-36 [&>div]:h-8" />
        <Input aria-label="To date" type="date" value={to} {...(from === "" ? {} : { min: from })} onChange={(event) => set("to", event.target.value)} className="w-36 [&>div]:h-8" />
        <Select label="League" size="sm" value={leagueId === "" ? "all" : leagueId} onChange={(next) => set("league", next === "all" ? undefined : next)} options={[{ value: "all", label: "All leagues" }, ...(leagues.data ?? []).map((l) => ({ value: String(l.id), label: l.name }))]} />
        {can("shops:read") && (
          <Select label="Shop" size="sm" value={shopId === "" ? "all" : shopId} onChange={(next) => set("shop", next === "all" ? undefined : next)} options={[{ value: "all", label: "All shops" }, ...(shops.data ?? []).map((shop) => ({ value: shop.id, label: `${shop.code} · ${shop.name}` }))]} />
        )}
        {(leagueId !== "" || shopId !== "") && <span className="text-sm text-text-muted">League and shop narrow the breakdown{shopId === "" ? " and sessions" : ""}; the overview covers the whole platform.</span>}
      </div>
      <div className="space-y-6">
        <section aria-labelledby="reports-overview">
          <SectionHeading id="reports-overview" className="mb-3">
            Overview
          </SectionHeading>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
            <MetricCard label="Accepted bets" state={metricFrom(overview, (d) => formatCount(d.acceptedBets))} hint={o === undefined ? undefined : `${formatCount(o.totalMatches)} matches`} />
            <MetricCard label="Total stake" state={metricFrom(overview, (d) => formatMoneyCompact(d.totalStake))} hint={o === undefined ? undefined : `${formatMoneyCompact(o.pendingStake)} pending`} />
            <MetricCard label="Total payout" state={metricFrom(overview, (d) => formatMoneyCompact(d.totalPayout))} hint="Paid on winning bets" />
            <MetricCard label="Operator result" state={metricFrom(overview, (d) => <SignedMoney value={d.operatorResult} whole />)} hint="Settled stake less payouts" />
            <MetricCard label="Operator result rate" state={metricFrom(overview, (d) => formatPercent(d.operatorResultRate))} hint="Of settled stake" />
            <MetricCard label="Customers" state={metricFrom(overview, (d) => formatCount(d.customers))} hint={o === undefined ? undefined : `${formatCount(o.shops)} shops · ${formatCount(o.cashiers)} cashiers`} />
          </div>
        </section>

        <section aria-labelledby="reports-breakdown" className="space-y-4">
          <SectionHeading id="reports-breakdown">Breakdown</SectionHeading>
          <div role="group" aria-label="Breakdown dimension" className="flex flex-wrap gap-1.5">
            {DIMENSIONS.map((dimension) => {
              const supported = dimension.by !== undefined;
              const active = supported && dimension.by === by;
              const button = (
                <button
                  key={dimension.label}
                  type="button"
                  aria-pressed={active}
                  disabled={!supported}
                  onClick={() => set("by", dimension.by === "league" ? undefined : dimension.by)}
                  className={cn(
                    "h-8 rounded-sm border px-3 text-sm font-medium transition-colors focus-ring pointer-coarse:h-11",
                    active ? "border-brand bg-brand-subtle text-text-primary" : "border-border bg-surface text-text-secondary hover:bg-surface-hover",
                    !supported && "cursor-not-allowed opacity-45 hover:bg-surface",
                  )}
                >
                  {dimension.label}
                </button>
              );

              return supported ? (
                button
              ) : (
                <Tooltip key={dimension.label} content="Not provided by the platform">
                  {button}
                </Tooltip>
              );
            })}
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <ChartPanel
              title={`Stake, payout and operator result by ${dimensionLabel.toLowerCase()}`}
              description={timeDimension ? "In time order" : `Top ${String(Math.min(CHART_ROWS, rows.length))} by stake`}
              className="xl:col-span-2"
              state={breakdown}
              isEmpty={rows.length === 0}
              chart={() => (
                <MainChart
                  title={`Stake, payout and operator result by ${dimensionLabel.toLowerCase()}`}
                  labels={(timeDimension ? rows : charted).map((r) => r.label)}
                  series={[
                    { key: "stake", label: "Stake", values: (timeDimension ? rows : charted).map((r) => r.stake) },
                    { key: "payout", label: "Payout", values: (timeDimension ? rows : charted).map((r) => r.payout) },
                    { key: "result", label: "Operator result", values: (timeDimension ? rows : charted).map((r) => r.operatorResult) },
                  ]}
                  formatValue={formatMoneyAxis}
                  height={260}
                />
              )}
              columns={[
                { key: "label", header: dimensionLabel },
                { key: "stake", header: "Stake", numeric: true },
                { key: "payout", header: "Payout", numeric: true },
                { key: "result", header: "Operator result", numeric: true },
              ]}
              rows={() => rows.map((r) => ({ key: r.key, label: r.label, stake: formatMoney(r.stake), payout: formatMoney(r.payout), result: <SignedMoney value={r.operatorResult} /> }))}
            />
            <ChartPanel
              title={`Exposure by ${dimensionLabel.toLowerCase()}`}
              description="Potential payout less stake on pending bets"
              state={breakdown}
              isEmpty={rows.every((r) => r.pendingLiability === 0)}
              chart={() => (
                <RankedBars
                  title={`Exposure by ${dimensionLabel.toLowerCase()}`}
                  formatValue={formatMoney}
                  items={rows
                    .filter((r) => r.pendingLiability > 0)
                    .slice(0, 8)
                    .map((r) => ({ key: r.key, label: r.label, detail: `${formatCount(r.pendingBets)} pending`, value: r.pendingLiability }))}
                />
              )}
              columns={[
                { key: "label", header: dimensionLabel },
                { key: "pending", header: "Pending bets", numeric: true },
                { key: "exposure", header: "Exposure", numeric: true },
              ]}
              rows={() => rows.map((r) => ({ key: r.key, label: r.label, pending: formatCount(r.pendingBets), exposure: formatMoney(r.pendingLiability) }))}
            />
          </div>

          <Panel title={`All rows by ${dimensionLabel.toLowerCase()}`} description={selectable ? "Select a row for the platform's analysis of that account" : "As the platform orders them"} flush>
            <DataTable
              caption={`Analytics by ${dimensionLabel.toLowerCase()}`}
              columns={columns}
              rows={breakdown.data?.items}
              rowKey={(r) => r.key}
              loading={breakdown.isPending}
              error={breakdown.error}
              onRetry={() => void breakdown.refetch()}
              pageSize={15}
              columnVisibility
              {...(selectable ? { onRowClick: (r: AnalyticsBreakdownRow) => (r.key === "none" ? undefined : set("subject", r.key)), selectedKey: subject } : {})}
              empty={{ title: emptyPresets.noAdminRecords.title, description: "The platform reports no bets for this window." }}
              renderCard={(r) => (
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate font-medium">{r.label}</span>
                    <SignedMoney value={r.operatorResult} className="type-financial" />
                  </div>
                  <p className="text-sm tabular text-text-secondary">
                    {formatCount(r.bets)} bets · stake {formatMoney(r.stake)} · payout {formatMoney(r.payout)}
                  </p>
                </div>
              )}
            />
          </Panel>
        </section>

        <section aria-labelledby="reports-bets" className="space-y-4">
          <SectionHeading id="reports-bets">Bets and activity</SectionHeading>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartPanel
              title="Accepted, limited and rejected bets"
              description="Accepted bets against the risk service's refusals"
              state={overview}
              isEmpty={o !== undefined && o.acceptedBets + o.limitedBets + o.rejectedBets === 0}
              chart={() => <BarChart title="Accepted, limited and rejected bets" labels={["Accepted", "Limited", "Rejected"]} series={[{ key: "bets", label: "Bets", values: o === undefined ? [] : [o.acceptedBets, o.limitedBets, o.rejectedBets] }]} formatValue={formatCount} height={220} />}
              columns={[
                { key: "label", header: "Decision" },
                { key: "bets", header: "Bets", numeric: true },
              ]}
              rows={() =>
                o === undefined
                  ? []
                  : [
                      { key: "accepted", label: "Accepted", bets: formatCount(o.acceptedBets) },
                      { key: "limited", label: "Limited", bets: formatCount(o.limitedBets) },
                      { key: "rejected", label: "Rejected", bets: formatCount(o.rejectedBets) },
                    ]
              }
            />
            <ChartPanel
              title="Win and loss distribution"
              description="Accepted bets by their current state"
              state={overview}
              isEmpty={o !== undefined && o.totalBets === 0}
              chart={() => <BarChart title="Win and loss distribution" labels={["Won", "Lost", "Void", "Cancelled", "Pending"]} series={[{ key: "bets", label: "Bets", values: o === undefined ? [] : [o.winningBets, o.losingBets, o.voidBets, o.cancelledBets, o.pendingBets] }]} formatValue={formatCount} height={220} />}
              columns={[
                { key: "label", header: "State" },
                { key: "bets", header: "Bets", numeric: true },
              ]}
              rows={() =>
                o === undefined
                  ? []
                  : [
                      { key: "won", label: "Won", bets: formatCount(o.winningBets) },
                      { key: "lost", label: "Lost", bets: formatCount(o.losingBets) },
                      { key: "void", label: "Void", bets: formatCount(o.voidBets) },
                      { key: "cancelled", label: "Cancelled", bets: formatCount(o.cancelledBets) },
                      { key: "pending", label: "Pending", bets: formatCount(o.pendingBets) },
                    ]
              }
            />
          </div>
          <div className="flex items-center justify-end">
            <Select label="Session grouping" size="sm" value={sessionKind} onChange={(next) => set("sessions", next === "MATCHDAY" ? undefined : next)} options={SESSION_KINDS} />
          </div>
          <ChartPanel
            title="Match activity"
            description="Bets per session, as the platform groups them"
            state={sessions}
            isEmpty={sessionRows.length === 0}
            chart={() => (
              <BarChart title="Bets per session" labels={sessionRows.map((s) => s.label)} series={[{ key: "bets", label: "Bets", values: sessionRows.map((s) => s.bets) }]} formatValue={formatCount} height={220} />
            )}
            columns={[
              { key: "label", header: "Session" },
              { key: "matches", header: "Matches", numeric: true },
              { key: "bets", header: "Bets", numeric: true },
              { key: "stake", header: "Stake", numeric: true },
              { key: "payout", header: "Payout", numeric: true },
              { key: "result", header: "Operator result", numeric: true },
            ]}
            rows={() => sessionRows.map((s) => ({ key: s.sessionId, label: s.label, matches: formatCount(s.matches), bets: formatCount(s.bets), stake: formatMoney(s.stake), payout: formatMoney(s.payout), result: <SignedMoney value={s.operatorResult} /> }))}
          />
        </section>
      </div>

      <Drawer open={subject !== undefined && selectable} onClose={() => set("subject", undefined)} size="lg" title={account.data?.label ?? `${dimensionLabel} analysis`} description="A view over the global bets for this account. It never implies separate games.">
        <AccountAnalysisPanel query={account} />
      </Drawer>
    </>
  );
}
