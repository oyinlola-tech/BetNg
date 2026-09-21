import { Link } from "react-router";
import { Activity, Radio } from "lucide-react";
import type { AuditLogEntry } from "@betng/contracts";
import { displayClock, formatMoneyCompact, formatRelative, formatShortDate } from "@betng/ui-core";
import { ActivityFeed, EmptyState, ErrorBoundary, ErrorState, Panel, SectionHeading, SkeletonRows, StatusBadge, TimeSeriesChart, emptyPresets, useNow, type ActivityItem, type StatusTone } from "@betng/ui-web";
import { DetailItem, Mono, SignedMoney, Status } from "../components/Bits";
import { MetricCard, metricFrom } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { useAnalyticsOverview, useAuditLog, useListTotal, useLiveMatches, useOperatorLedger, useOverview, useReportDays, useRiskOverview, useServiceHealth } from "../hooks/queries";
import { useAdmin } from "../hooks/useAdmin";
import { HEALTH, dayKey, formatCount, formatMoneyAxis, formatPercent, shortDay } from "../lib/format";

const SEVERITY_TONE: Readonly<Record<string, StatusTone>> = { INFO: "neutral", NOTICE: "brand", WARNING: "warning", CRITICAL: "danger" };

const moreLink = "rounded-xs text-sm font-medium text-brand hover:underline focus-ring";

function HealthList(): React.JSX.Element {
  const health = useServiceHealth();

  if (health.data === undefined) return health.error !== null ? <ErrorState error={health.error} compact onRetry={() => void health.refetch()} /> : <SkeletonRows rows={4} className="p-4" />;
  if (health.data.length === 0) return <EmptyState compact title="No services reported" description="The platform answered an empty service list." />;

  return (
    <ul className="-mb-px -mr-px grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
      {health.data.map((service) => (
        <li key={service.service} className="flex items-center justify-between gap-2 border-b border-r border-border px-4 py-2.5">
          <span className="min-w-0">
            <span className="block truncate text-base font-medium capitalize text-text-primary">{service.service}</span>
            <StatusBadge status={HEALTH[service.status].status} className="text-xs text-text-secondary">
              {HEALTH[service.status].label}
            </StatusBadge>
          </span>
          <Mono>{service.status === "unavailable" ? "no answer" : `${String(service.latencyMs)} ms`}</Mono>
        </li>
      ))}
    </ul>
  );
}

function LiveList(): React.JSX.Element {
  const live = useLiveMatches();
  const now = useNow(1000);

  if (live.data === undefined) return live.error !== null ? <ErrorState error={live.error} compact onRetry={() => void live.refetch()} /> : <SkeletonRows rows={4} className="p-4" />;
  if (live.data.length === 0) return <EmptyState compact icon={<Radio className="size-5" />} title={emptyPresets.noLiveMatches.title} description={emptyPresets.noLiveMatches.description} />;

  return (
    <ul className="divide-y divide-border">
      {live.data.slice(0, 6).map((match) => (
        <li key={match.id}>
          <Link to={`/matches/${match.id}`} className="flex items-center gap-3 px-4 py-2 text-base hover:bg-surface-hover focus-ring">
            <span className="mono-id w-12 shrink-0 font-semibold text-live">{displayClock(match.clock, now)?.label ?? "LIVE"}</span>
            <span className="min-w-0 flex-1 truncate text-text-primary">
              {match.home.shortName} <span className="text-text-muted">v</span> {match.away.shortName}
            </span>
            <span className="font-display font-semibold tabular">
              {match.score.home}–{match.score.away}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function activityItems(entries: readonly AuditLogEntry[]): readonly ActivityItem[] {
  return entries.map((entry) => ({
    id: entry.id,
    title: (
      <>
        <span className="font-medium">{entry.actorName}</span> <span className="mono-id">{entry.action}</span>
      </>
    ),
    detail: `${entry.resource}${entry.resourceId === undefined ? "" : ` · ${entry.resourceId.slice(0, 8)}`}`,
    time: formatRelative(entry.timestamp),
    tone: SEVERITY_TONE[entry.severity ?? "INFO"] ?? "neutral",
    icon: <Activity />,
  }));
}

export function DashboardPage(): React.JSX.Element {
  const { can, admin } = useAdmin();
  const reportsGranted = can("reports:read");
  const settlementGranted = can("settlement:read");
  const riskGranted = can("risk:read");

  const overview = useOverview();
  const analytics = useAnalyticsOverview({}, reportsGranted);
  const risk = useRiskOverview(riskGranted);
  const ledger = useOperatorLedger(settlementGranted);
  const pendingSettlements = useListTotal("settlements", { status: "PENDING" }, settlementGranted);
  const failedSettlements = useListTotal("settlements", { status: "FAILED" }, settlementGranted);
  const reports = useReportDays(dayKey(13), dayKey(0), reportsGranted);
  const audit = useAuditLog({ page: 1, pageSize: 8 }, can("audit:read"));

  const reportsPermission = { name: "reports:read", granted: reportsGranted };
  const settlementPermission = { name: "settlement:read", granted: settlementGranted };
  const a = analytics.data;
  const current = ledger.data?.current;
  const days = reports.data ?? [];
  const windowLabel = a === undefined ? undefined : a.from === undefined && a.to === undefined ? "All accepted bets on record" : `${a.from === undefined ? "Start" : formatShortDate(a.from)} to ${a.to === undefined ? "now" : formatShortDate(a.to)}`.replace(/^(.+) to \1$/, "$1");

  return (
    <>
      <PageHeader title="Dashboard" description={`Signed in as ${admin?.displayName ?? ""}. Every figure is reported by the platform; none is calculated on this screen.`} />
      <div className="space-y-6">
        <section aria-labelledby="dash-activity">
          <SectionHeading id="dash-activity" className="mb-3">
            Matches and bets
          </SectionHeading>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <MetricCard label="Active matches" state={{ kind: "unavailable" }} />
            <MetricCard label="Live matches" state={metricFrom(overview, (o) => formatCount(o.liveMatches))} hint="In play now" />
            <MetricCard label="Pending bets" state={metricFrom(overview, (o) => formatCount(o.openBets))} hint="Awaiting a result" />
            <MetricCard label="Accepted bets" state={metricFrom(analytics, (d) => formatCount(d.acceptedBets), reportsPermission)} hint={windowLabel} />
            <MetricCard label="Rejected bets" state={metricFrom(analytics, (d) => formatCount(d.rejectedBets), reportsPermission)} hint={a === undefined ? undefined : `${formatCount(a.limitedBets)} limited by risk`} />
          </div>
        </section>

        <section aria-labelledby="dash-money">
          <SectionHeading id="dash-money" className="mb-3">
            Stakes and operator result
          </SectionHeading>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <MetricCard label="Total stake" state={metricFrom(analytics, (d) => formatMoneyCompact(d.totalStake), reportsPermission)} hint="Cancelled bets excluded" />
            <MetricCard label="Total payout" state={metricFrom(analytics, (d) => formatMoneyCompact(d.totalPayout), reportsPermission)} hint="Paid on winning bets" />
            <MetricCard label="Operator result" state={metricFrom(analytics, (d) => <SignedMoney value={d.operatorResult} whole />, reportsPermission)} hint="Settled stake less payouts" />
            <MetricCard label="Operator result rate" state={metricFrom(analytics, (d) => formatPercent(d.operatorResultRate), reportsPermission)} hint="Of settled stake" />
            <MetricCard label="Open exposure" state={metricFrom(risk, (d) => formatMoneyCompact(d.exposure), { name: "risk:read", granted: riskGranted })} hint={risk.data === undefined ? undefined : `Limit ${formatMoneyCompact(risk.data.exposureLimit)}`} />
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-3">
          <Panel title="System health" flush className="overflow-hidden xl:col-span-2" actions={can("health:read") ? <Link to="/health" className={moreLink}>Details</Link> : undefined}>
            {can("health:read") ? <HealthList /> : <EmptyState compact title="Not included in your role" description="Service health needs the “health:read” permission." />}
          </Panel>
          <Panel title="Settlement status" actions={settlementGranted ? <Link to="/settlement" className={moreLink}>Settlement</Link> : undefined}>
            <div className="grid grid-cols-2 gap-x-3 gap-y-4">
              <MetricCard label="Pending" state={metricFrom(pendingSettlements, (total) => formatCount(total), settlementPermission)} className="min-h-0 border-0 p-0" />
              <MetricCard label="Failed" state={metricFrom(failedSettlements, (total) => formatCount(total), settlementPermission)} className="min-h-0 border-0 p-0" />
              <MetricCard label="Settled bets" state={metricFrom(ledger, (d) => formatCount(d.current.settledBets), settlementPermission)} hint="Current operator period" className="min-h-0 border-0 p-0" />
              <MetricCard label="Void bets" state={metricFrom(ledger, (d) => formatCount(d.current.voidBets), settlementPermission)} hint="Current operator period" className="min-h-0 border-0 p-0" />
            </div>
          </Panel>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Panel title="Current operator period" description="The operator ledger, not a customer wallet" className="xl:col-span-2" actions={can("wallet:read") ? <Link to="/wallet" className={moreLink}>Ledgers</Link> : undefined}>
            {!settlementGranted ? (
              <EmptyState compact title="Not included in your role" description="The operator ledger needs the “settlement:read” permission." />
            ) : current === undefined ? (
              ledger.error !== null ? (
                <ErrorState error={ledger.error} compact onRetry={() => void ledger.refetch()} />
              ) : (
                <SkeletonRows rows={2} />
              )
            ) : (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
                <DetailItem label="Period">
                  <Mono className="text-text-primary">{current.period.id}</Mono>
                </DetailItem>
                <DetailItem label="Status">
                  <Status value={current.period.status} />
                </DetailItem>
                <DetailItem label="Gross stakes">
                  <span className="type-financial">{formatMoneyCompact(current.grossStakes)}</span>
                </DetailItem>
                <DetailItem label="Gross payouts">
                  <span className="type-financial">{formatMoneyCompact(current.grossPayouts)}</span>
                </DetailItem>
                <DetailItem label="Operator result">
                  <SignedMoney value={current.operatorResult} className="type-financial" />
                </DetailItem>
                <DetailItem label="Result rate">
                  <span className="type-financial">{formatPercent(current.operatorResultRate)}</span>
                </DetailItem>
                <DetailItem label="Refunded stakes">
                  <span className="type-financial">{formatMoneyCompact(current.refundedStakes)}</span>
                </DetailItem>
                <DetailItem label="Opened">{formatShortDate(current.period.startsAt)}</DetailItem>
              </dl>
            )}
          </Panel>
          <Panel title="In play" flush actions={can("fixtures:read") ? <Link to="/live" className={moreLink}>Live control</Link> : undefined}>
            <ErrorBoundary scope="feature">
              <LiveList />
            </ErrorBoundary>
          </Panel>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {reportsGranted && (
            <Panel title="Stake and payouts" description="Last 14 days, as reported per day" className="xl:col-span-2">
              <ErrorBoundary scope="feature">
                {reports.data === undefined ? (
                  reports.error !== null ? (
                    <ErrorState error={reports.error} compact onRetry={() => void reports.refetch()} />
                  ) : (
                    <SkeletonRows rows={5} />
                  )
                ) : days.length === 0 ? (
                  <EmptyState compact title="No daily figures" description="The platform answered no days for this range." />
                ) : (
                  <TimeSeriesChart
                    title="Stake and payouts over the last 14 days"
                    labels={days.map((d) => shortDay(d.date))}
                    series={[
                      { key: "stake", label: "Stake", values: days.map((d) => d.stake) },
                      { key: "payouts", label: "Payouts", values: days.map((d) => d.payouts) },
                    ]}
                    formatValue={formatMoneyAxis}
                    height={220}
                  />
                )}
              </ErrorBoundary>
            </Panel>
          )}
          {can("audit:read") && (
            <Panel title="Recent activity" flush className={reportsGranted ? undefined : "xl:col-span-3"} actions={<Link to="/audit" className={moreLink}>Audit logs</Link>}>
              {audit.data === undefined ? audit.error !== null ? <ErrorState error={audit.error} compact onRetry={() => void audit.refetch()} /> : <SkeletonRows rows={6} className="p-4" /> : <ActivityFeed items={activityItems(audit.data.items)} />}
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
