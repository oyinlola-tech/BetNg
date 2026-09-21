import { useMemo } from "react";
import { useNavigate } from "react-router";
import { CircleSlash } from "lucide-react";
import type { MatchExposure } from "@betng/contracts";
import { formatDateTime, formatMoney, formatMoneyCompact, formatOdds } from "@betng/ui-core";
import { DataTable, ErrorBoundary, ErrorState, Panel, RankedBars, SectionHeading, SkeletonRows, StatusBadge, emptyPresets, type Column } from "@betng/ui-web";
import { Meter, SignedMoney, Status, Unavailable } from "../components/Bits";
import { MetricCard, metricFrom } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { RiskLimitsForm } from "../components/RiskLimitsForm";
import { useExposure, useRiskLimits, useRiskOverview } from "../hooks/queries";
import { formatCount, formatStamp, humanise } from "../lib/format";

interface ExposureRow {
  readonly key: string;
  readonly match: MatchExposure;
  readonly market: MatchExposure["markets"][number];
  readonly selection: MatchExposure["markets"][number]["selections"][number];
}

function flatten(board: readonly MatchExposure[]): readonly ExposureRow[] {
  return board.flatMap((match) => match.markets.flatMap((market) => market.selections.map((selection) => ({ key: `${match.matchId}:${market.marketId}:${selection.selectionId}`, match, market, selection }))));
}

function marketName(market: ExposureRow["market"]): string {
  return `${humanise(market.type)}${market.line === undefined ? "" : ` ${String(market.line)}`}`;
}

const DECISIONS = [
  { key: "accepted", status: "ACCEPTED", word: "ACCEPT", help: "Taken at the requested stake" },
  { key: "limited", status: "LIMITED", word: "LIMIT", help: "Taken at a reduced stake" },
  { key: "rejected", status: "REJECTED", word: "REJECT", help: "Refused outright" },
] as const;

export function RiskPage(): React.JSX.Element {
  const navigate = useNavigate();
  const overview = useRiskOverview();
  const exposure = useExposure();
  const limits = useRiskLimits();
  const rows = useMemo(() => (exposure.data === undefined ? undefined : flatten(exposure.data)), [exposure.data]);
  const r = overview.data;
  const selectionLimit = limits.data?.maxLiabilityPerSelection;

  const columns: readonly Column<ExposureRow>[] = [
    {
      key: "match",
      header: "Match",
      hideable: false,
      cell: (row) => (
        <span className="block min-w-40">
          <span className="block truncate font-medium">{row.match.matchLabel}</span>
          <span className="block truncate text-sm text-text-muted">{row.match.leagueName}</span>
        </span>
      ),
    },
    { key: "market", header: "Market", cell: (row) => <span className="whitespace-nowrap text-text-secondary">{marketName(row.market)}</span> },
    { key: "selection", header: "Selection", cell: (row) => <span className="whitespace-nowrap font-medium">{row.selection.label}</span> },
    { key: "odds", header: "Odds", numeric: true, cell: (row) => formatOdds(row.selection.odds), hideBelow: "lg" },
    { key: "bets", header: "Bets", numeric: true, cell: (row) => formatCount(row.selection.bets), hideBelow: "lg" },
    { key: "stake", header: "Stake", numeric: true, cell: (row) => formatMoney(row.selection.totalStake), hideBelow: "xl" },
    { key: "payout", header: "Potential payout", numeric: true, cell: (row) => formatMoney(row.selection.potentialPayout), hideBelow: "xl", defaultHidden: true },
    { key: "exposure", header: "Net exposure", numeric: true, cell: (row) => <SignedMoney value={row.selection.netExposure} className="type-financial" /> },
    { key: "limit", header: "Selection limit", numeric: true, cell: () => (selectionLimit === undefined ? <Unavailable what="The limit" /> : formatMoney(selectionLimit)), hideBelow: "xl" },
    { key: "status", header: "Status", cell: (row) => <Status value={row.selection.status} /> },
    { key: "frozen", header: "Frozen at", cell: (row) => <span className="whitespace-nowrap tabular text-text-secondary">{formatStamp(row.match.frozenAt)}</span>, hideBelow: "xl", defaultHidden: true },
  ];

  return (
    <>
      <PageHeader title="Risk" description="What the risk service reports: exposure on accepted bets, the limits it applies and how many bets it accepted, limited or rejected. This console shows its decisions and never makes one." />
      <div className="space-y-6">
        <section aria-labelledby="risk-overview">
          <SectionHeading id="risk-overview" className="mb-3">
            Book overview
          </SectionHeading>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Total stake" state={metricFrom(overview, (d) => formatMoneyCompact(d.totalStake))} hint="Open and in play" />
            <MetricCard label="Potential payout" state={metricFrom(overview, (d) => formatMoneyCompact(d.potentialPayout))} hint="On pending bets" />
            <MetricCard label="Open exposure" state={metricFrom(overview, (d) => formatMoneyCompact(d.exposure))} hint={r === undefined ? undefined : `Limit ${formatMoneyCompact(r.exposureLimit)}`} />
            <MetricCard label="Risk state" state={metricFrom(overview, (d) => <Status value={d.state} />)} hint={r === undefined ? undefined : `As of ${formatDateTime(r.generatedAt)}`} />
          </div>
          {r !== undefined && (
            <div className="mt-3 rounded-md border border-border bg-surface px-4 py-3">
              <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
                <span className="text-text-secondary">Open exposure against the platform limit</span>
                <span className="tabular text-text-muted">
                  {formatMoney(r.exposure)} of {formatMoney(r.exposureLimit)}
                </span>
              </div>
              <Meter value={r.exposure} limit={r.exposureLimit} label="Open exposure against the platform limit" />
            </div>
          )}
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Risk decisions" description="Counts reported by the risk service">
            {r === undefined ? (
              overview.error !== null ? (
                <ErrorState error={overview.error} compact onRetry={() => void overview.refetch()} />
              ) : (
                <SkeletonRows rows={3} />
              )
            ) : (
              <>
                <dl className="space-y-3">
                  {DECISIONS.map((decision) => (
                    <div key={decision.key} className="flex items-center justify-between gap-3">
                      <dt>
                        <StatusBadge status={decision.status}>{decision.word}</StatusBadge>
                        <span className="block text-sm text-text-muted">{decision.help}</span>
                      </dt>
                      <dd className="font-display text-lg font-semibold tabular">{formatCount(r.decisions[decision.key])}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 flex items-start gap-1.5 border-t border-border pt-3 text-sm text-text-muted">
                  <CircleSlash className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  The platform does not list individual decisions with their reason and time, so they are not shown.
                </p>
              </>
            )}
          </Panel>
          <Panel title="Exposure by market type" className="lg:col-span-2">
            <ErrorBoundary scope="feature">
              {r === undefined ? <SkeletonRows rows={5} /> : <RankedBars title="Exposure by market type" formatValue={formatMoney} items={r.byMarket.map((m) => ({ key: m.marketType, label: m.marketLabel, detail: `stake ${formatMoneyCompact(m.stake)}`, value: m.exposure }))} />}
            </ErrorBoundary>
          </Panel>
        </div>

        <Panel title="Exposure board" description="One row per selection with accepted bets, in the order the risk service reports" flush>
          <DataTable
            caption="Exposure by selection"
            columns={columns}
            rows={rows}
            rowKey={(row) => row.key}
            loading={exposure.isPending}
            error={exposure.error}
            onRetry={() => void exposure.refetch()}
            onRowClick={(row) => void navigate(`/matches/${row.match.matchId}`)}
            pageSize={20}
            columnVisibility
            empty={{ title: emptyPresets.noAdminRecords.title, description: "The risk service reports no open liability." }}
            renderCard={(row) => (
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{row.match.matchLabel}</span>
                    <span className="block truncate text-sm text-text-muted">
                      {marketName(row.market)} · {row.selection.label}
                    </span>
                  </span>
                  <Status value={row.selection.status} />
                </div>
                <div className="flex items-baseline justify-between text-sm text-text-secondary">
                  <span>{formatCount(row.selection.bets)} bets</span>
                  <SignedMoney value={row.selection.netExposure} className="type-financial text-text-primary" />
                </div>
              </div>
            )}
          />
        </Panel>

        <Panel title="Risk limits" description="Read from the risk service. Changing them needs “risk:write”, a reason and a confirmation.">
          {limits.data === undefined ? (
            limits.error !== null ? (
              <ErrorState error={limits.error} compact onRetry={() => void limits.refetch()} />
            ) : (
              <SkeletonRows rows={4} />
            )
          ) : (
            <RiskLimitsForm limits={limits.data} />
          )}
        </Panel>
      </div>
    </>
  );
}
