import { Link } from "react-router";
import { Activity, Banknote, CircleDollarSign, Radio, Store, Ticket, TrendingUp, Users } from "lucide-react";
import type { AuditLogEntry } from "@betng/contracts";
import { formatRelative } from "@betng/ui-core";
import { ActivityFeed, EmptyState, ErrorState, KpiCard, Panel, SkeletonRows, StatusBadge, TimeSeriesChart, cn, useNow, type ActivityItem, type StatusTone } from "@betng/ui-web";
import { PageHeader } from "../components/PageHeader";
import { useAuditLog, useLiveMatches, useOverview, useReportDays, useServiceHealth } from "../hooks/queries";
import { useAdmin } from "../hooks/useAdmin";
import { HEALTH, daysAgoKey, formatMoneyShort, liveClock, shortDay } from "../lib/format";

const SEVERITY_TONE: Readonly<Record<string, StatusTone>> = { INFO: "neutral", NOTICE: "brand", WARNING: "warning", CRITICAL: "danger" };

/** Consecutive sign-ins by the same actor become one row with a count, so they do not push real operations out of the feed. */
function collapseLogins(entries: readonly AuditLogEntry[]): readonly { readonly entry: AuditLogEntry; readonly count: number }[] {
  const out: { entry: AuditLogEntry; count: number }[] = [];

  for (const entry of entries) {
    const last = out.at(-1);

    if (last !== undefined && entry.action === "admin.login" && last.entry.action === "admin.login" && last.entry.actor === entry.actor) last.count += 1;
    else out.push({ entry, count: 1 });
  }

  return out;
}

function HealthGrid(): React.JSX.Element {
  const health = useServiceHealth();

  if (health.data === undefined) return health.error !== null ? <ErrorState error={health.error} compact onRetry={() => void health.refetch()} /> : <SkeletonRows rows={4} className="p-4" />;

  return (
    <ul className="grid grid-cols-2 gap-px overflow-hidden bg-border sm:grid-cols-3 xl:grid-cols-4">
      {health.data.map((service) => {
        const view = HEALTH[service.status];

        return (
          <li key={service.service} className={cn("flex items-center justify-between gap-2 bg-surface px-3 py-2.5", service.status === "unavailable" && "bg-danger-subtle", service.status === "degraded" && "bg-warning-subtle")}>
            <div className="min-w-0">
              <p className="truncate text-base font-medium capitalize text-text-primary">{service.service}</p>
              <StatusBadge tone={view.tone} className="text-xs text-text-secondary">
                {view.label}
              </StatusBadge>
            </div>
            <span className="mono-id tabular text-text-muted">{service.status === "unavailable" ? "—" : `${String(service.latencyMs)}ms`}</span>
          </li>
        );
      })}
      <li aria-hidden className="bg-surface" />
    </ul>
  );
}

function LiveList(): React.JSX.Element {
  const live = useLiveMatches();
  const now = useNow(1000);

  if (live.data === undefined) return <SkeletonRows rows={4} className="p-4" />;
  if (live.data.length === 0) return <EmptyState compact icon={<Radio className="size-5" />} title="No match in play" description="The next matchday kicks off within a few minutes." />;

  return (
    <ul className="divide-y divide-border">
      {live.data.slice(0, 5).map((match) => (
        <li key={match.id}>
          <Link to={`/matches/${match.id}`} className="flex items-center gap-3 px-4 py-2 text-base hover:bg-surface-hover focus-ring">
            <span className="mono-id w-12 shrink-0 tabular text-live">{liveClock(match.kickoffAt, now)}</span>
            <span className="min-w-0 flex-1 truncate text-text-primary">
              {match.home.shortName} <span className="text-text-muted">v</span> {match.away.shortName}
            </span>
            <span className="font-display font-semibold tabular">
              {match.score.home}–{match.score.away}
            </span>
            <span className="hidden w-10 shrink-0 text-right text-xs text-text-muted sm:block">{match.leagueCode}</span>
          </Link>
        </li>
      ))}
      {live.data.length > 5 && (
        <li className="px-4 py-2 text-sm text-text-muted">
          and {live.data.length - 5} more in{" "}
          <Link to="/live" className="font-medium text-brand hover:underline focus-ring">
            Live control
          </Link>
        </li>
      )}
    </ul>
  );
}

export function DashboardPage(): React.JSX.Element {
  const { can, admin } = useAdmin();
  const overview = useOverview();
  const reports = useReportDays(daysAgoKey(13), daysAgoKey(0), can("reports:read"));
  const audit = useAuditLog({ page: 1, pageSize: 40 }, can("audit:read"));
  const o = overview.data;
  const days = reports.data ?? [];
  const yesterday = days.at(-2);

  const activity: readonly ActivityItem[] = collapseLogins(audit.data?.items ?? []).slice(0, 8).map(({ entry, count }) => ({
    id: entry.id,
    title: (
      <>
        <span className="font-medium">{entry.actorName}</span> <span className="mono-id">{entry.action}</span>
        {count > 1 && <span className="ml-1.5 rounded-xs bg-surface-sunken px-1 py-0.5 text-xs font-semibold tabular text-text-secondary">×{count}</span>}
      </>
    ),
    detail: count > 1 ? `${String(count)} sign-ins in a row` : `${entry.resource}${entry.resourceId === undefined ? "" : ` · ${entry.resourceId.slice(0, 8)}`}`,
    time: formatRelative(entry.timestamp),
    tone: SEVERITY_TONE[entry.severity ?? "INFO"] ?? "neutral",
    icon: <Activity />,
  }));

  return (
    <>
      <PageHeader title="Operations dashboard" description={`Signed in as ${admin?.displayName ?? ""}. Figures are simulated naira and refresh on their own.`} />
      {overview.error !== null && o === undefined ? (
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
      ) : (
        <div className="space-y-4">
          <section aria-label="Platform activity" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Active users" value={o?.activeUsers.toLocaleString()} hint="last 15 min" icon={<Users />} />
            <KpiCard label="Active shops" value={o?.activeShops.toLocaleString()} hint="trading today" icon={<Store />} />
            <KpiCard label="Open bets" value={o?.openBets.toLocaleString()} hint="awaiting results" icon={<Ticket />} />
            <KpiCard label="Live matches" value={o?.liveMatches.toLocaleString()} hint="in play now" icon={<Radio />} />
          </section>
          <section aria-label="Today's money" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KpiCard label="Today's stake" value={o === undefined ? undefined : formatMoneyShort(o.todayStake)} hint="so far today" icon={<Banknote />} />
            <KpiCard label="Today's payouts" value={o === undefined ? undefined : formatMoneyShort(o.todayPayouts)} hint={o === undefined || o.todayStake === 0 ? undefined : `${((o.todayPayouts / o.todayStake) * 100).toFixed(1)}% of stake`} icon={<CircleDollarSign />} />
            <KpiCard label="Simulated net" value={o === undefined ? undefined : formatMoneyShort(o.todayNet)} hint={yesterday === undefined ? undefined : `yesterday ${formatMoneyShort(yesterday.net)}`} icon={<TrendingUp />} emphasis />
          </section>

          <div className="grid gap-4 xl:grid-cols-3">
            {can("health:read") && (
              <Panel title="System health" flush className="xl:col-span-2" actions={<Link to="/health" className="text-sm font-medium text-brand hover:underline focus-ring">Details</Link>}>
                <HealthGrid />
              </Panel>
            )}
            <Panel title="In play" flush className={cn(!can("health:read") && "xl:col-span-3")} actions={<Link to="/live" className="text-sm font-medium text-brand hover:underline focus-ring">Live control</Link>}>
              <LiveList />
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {can("reports:read") && (
              <Panel title="Stake and payouts" description="Last 14 days, simulated naira" className="xl:col-span-2">
                {days.length === 0 ? (
                  <SkeletonRows rows={5} />
                ) : (
                  <TimeSeriesChart
                    title="Stake and payouts over the last 14 days"
                    labels={days.map((d) => shortDay(d.date))}
                    series={[
                      { key: "stake", label: "Stake", values: days.map((d) => d.stake) },
                      { key: "payouts", label: "Payouts", values: days.map((d) => d.payouts) },
                    ]}
                    formatValue={formatMoneyShort}
                    height={230}
                  />
                )}
              </Panel>
            )}
            {can("audit:read") && (
              <Panel title="Recent activity" flush actions={<Link to="/audit" className="text-sm font-medium text-brand hover:underline focus-ring">Audit log</Link>}>
                {audit.data === undefined ? <SkeletonRows rows={6} className="p-4" /> : <ActivityFeed items={activity} />}
              </Panel>
            )}
          </div>
        </div>
      )}
    </>
  );
}
