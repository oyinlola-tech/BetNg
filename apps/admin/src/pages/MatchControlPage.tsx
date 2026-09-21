import { Link, useParams } from "react-router";
import { Ban, DoorClosed, DoorOpen, Play, RotateCcw, ShieldCheck } from "lucide-react";
import type { AdminFixture, MatchAdminAction } from "@betng/contracts";
import { formatDateTime, formatKickoffTime, formatMoney } from "@betng/ui-core";
import { ActivityFeed, AdminSkeleton, ConnectionStrip, EmptyState, ErrorBoundary, ErrorState, MatchTimeline, Panel, Scoreboard, SkeletonRows, StaleBadge, StatsPanel } from "@betng/ui-web";
import { DetailItem, Mono, Status } from "../components/Bits";
import { GuardedButton } from "../components/Guard";
import { MarketsBoard } from "../components/MarketsBoard";
import { PageHeader } from "../components/PageHeader";
import { useReasonAction } from "../components/ReasonAction";
import { useAdminAction, useAuditLog, useExposure, useFixture, useMarketOdds, useMatchSettlements, useMatchSimulation } from "../hooks/queries";
import { useAdmin } from "../hooks/useAdmin";
import { useLiveMatch } from "../hooks/useLiveMatch";
import { formatCount } from "../lib/format";
import { adminSource } from "../services/runtime";

interface Operation {
  readonly action: MatchAdminAction;
  readonly label: string;
  readonly icon: React.ReactNode;
  readonly tone: "primary" | "danger";
  readonly consequence: string;
  readonly blocked: (f: AdminFixture) => string | undefined;
}

/* Exactly the actions `matchAdminActionSchema` allows. None of them writes a result. */
const OPERATIONS: readonly Operation[] = [
  {
    action: "OPEN_BETTING",
    label: "Reopen betting",
    icon: <DoorOpen className="size-4" aria-hidden />,
    tone: "primary",
    consequence: "Markets accept bets again until the scheduled close before kick-off.",
    blocked: (f) => (f.bettingStatus === "SUSPENDED" ? undefined : "Available only while betting is suspended by an operator"),
  },
  {
    action: "CLOSE_BETTING",
    label: "Suspend betting",
    icon: <DoorClosed className="size-4" aria-hidden />,
    tone: "danger",
    consequence: "Every market on this match stops taking bets. Bets already placed stand.",
    blocked: (f) => (f.bettingStatus === "OPEN" ? undefined : "Betting is not open on this match"),
  },
  {
    action: "START_SIMULATION",
    label: "Prepare run now",
    icon: <Play className="size-4" aria-hidden />,
    tone: "primary",
    consequence: "The queued run is handed to the simulation service ahead of the scheduler. The service still draws the result.",
    blocked: (f) => (f.simulationStatus === "QUEUED" && f.matchStatus !== "SCHEDULED" ? undefined : "Available for a queued run once betting has opened"),
  },
  {
    action: "RERUN_SIMULATION",
    label: "Re-queue failed run",
    icon: <RotateCcw className="size-4" aria-hidden />,
    tone: "primary",
    consequence: "The failed run is queued again with the same inputs. A recorded result is immutable and can never be re-run.",
    blocked: (f) => (f.simulationStatus === "FAILED" ? undefined : "Available only when the run has failed"),
  },
  {
    action: "VOID_MATCH",
    label: "Void match",
    icon: <Ban className="size-4" aria-hidden />,
    tone: "danger",
    consequence: "The match is cancelled, every bet on it is voided and stakes are refunded at settlement. This cannot be undone.",
    blocked: (f) => (f.matchStatus === "CANCELLED" ? "This match is already void" : f.settlementStatus === "COMPLETED" ? "Settled matches cannot be voided" : undefined),
  },
];

function recordedReason(after: unknown): string | undefined {
  if (typeof after !== "object" || after === null || !("reason" in after)) return undefined;

  return typeof after.reason === "string" ? after.reason : undefined;
}

export function MatchControlPage(): React.JSX.Element {
  const { matchId } = useParams();
  const { can } = useAdmin();
  const fixture = useFixture(matchId);
  const live = useLiveMatch(matchId);
  const label = fixture.data === undefined ? undefined : `${fixture.data.homeName} v ${fixture.data.awayName}`;
  const odds = useMarketOdds(matchId, can("odds:read"));
  const exposure = useExposure(can("risk:read"));
  const simulation = useMatchSimulation(matchId, can("simulation:read"));
  const settlements = useMatchSettlements(label, can("settlement:read"));
  const audit = useAuditLog({ resource: matchId ?? "", pageSize: 10 }, can("audit:read") && matchId !== undefined);
  const { ask, dialog } = useReasonAction();
  const operate = useAdminAction({
    run: (input: { readonly action: MatchAdminAction; readonly reason: string }) => adminSource.matchAction(matchId ?? "", input),
    success: (_, input) => `${OPERATIONS.find((o) => o.action === input.action)?.label ?? "Action"} applied`,
  });

  if (fixture.data === undefined || label === undefined) return fixture.error !== null ? <ErrorState error={fixture.error} onRetry={() => void fixture.refetch()} /> : <AdminSkeleton kpis={4} rows={6} />;

  const f = fixture.data;
  const match = live.match;
  const run = simulation.data;
  const book = exposure.data?.find((m) => m.matchId === f.matchId);
  const disconnected = live.connection !== "CONNECTED";

  return (
    <>
      <PageHeader title={label} description={`${f.leagueName} · Season ${String(f.season)} · Matchday ${String(f.matchday)} · ${formatDateTime(f.kickoffAt)}`} actions={disconnected && match !== undefined ? <StaleBadge updatedAt={live.syncedAt} /> : undefined} />
      <ConnectionStrip state={live.connection} lastUpdatedAt={live.syncedAt} className="mb-4 rounded-md" />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Panel>
            <ErrorBoundary scope="feature">{match === undefined ? <SkeletonRows rows={3} /> : <Scoreboard match={match} size="md" />}</ErrorBoundary>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 md:grid-cols-4">
              <DetailItem label="Betting">
                <Status value={f.bettingStatus} />
              </DetailItem>
              <DetailItem label="Match">
                <Status value={f.matchStatus} />
              </DetailItem>
              <DetailItem label="Simulation">
                <Status value={f.simulationStatus} />
              </DetailItem>
              <DetailItem label="Settlement">
                <Status value={f.settlementStatus} />
              </DetailItem>
            </dl>
          </Panel>

          <section aria-labelledby="markets-heading">
            <h2 id="markets-heading" className="type-section mb-2">
              Markets
            </h2>
            {can("odds:read") ? (
              <MarketsBoard markets={odds.data} loading={odds.isPending} error={odds.error} onRetry={() => void odds.refetch()} mode="odds" linkMatches={false} showMatchHeader={false} bettingClosed={f.bettingStatus === "CLOSED"} />
            ) : (
              <Panel>
                <EmptyState compact title="Not included in your role" description="Markets need the “odds:read” permission." />
              </Panel>
            )}
          </section>

          <Panel title="Settlement" description="Most recent settlements the platform lists for this match" flush actions={can("settlement:read") ? <Link to={`/settlement?q=${encodeURIComponent(label)}`} className="rounded-xs text-sm font-medium text-brand hover:underline focus-ring">All settlements</Link> : undefined}>
            {!can("settlement:read") ? (
              <EmptyState compact title="Not included in your role" description="Settlements need the “settlement:read” permission." />
            ) : settlements.data === undefined ? (
              settlements.error !== null ? (
                <ErrorState error={settlements.error} compact onRetry={() => void settlements.refetch()} />
              ) : (
                <SkeletonRows rows={3} className="p-4" />
              )
            ) : settlements.data.items.length === 0 ? (
              <EmptyState compact title={f.settlementStatus === "NOT_DUE" ? "Not due yet" : "No settlements listed"} description={f.settlementStatus === "NOT_DUE" ? "Bets settle after the platform records the result." : "The platform lists no settlement for this match."} />
            ) : (
              <ul className="divide-y divide-border">
                {settlements.data.items.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-base">
                    <Mono className="w-28 truncate">{s.betId}</Mono>
                    <span className="min-w-32 flex-1 truncate text-text-secondary">{s.owner.replace(/^(user|shop):/, "")}</span>
                    <span className="tabular text-text-muted">stake {formatMoney(s.stake)}</span>
                    <span className="type-financial w-32 text-right">{formatMoney(s.payout)}</span>
                    <span className="w-28">
                      <Status value={s.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Operations">
            <p className="mb-3 flex items-start gap-2 rounded-sm bg-surface-sunken px-3 py-2 text-sm text-text-secondary">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
              Results come only from the simulation service. This console can pause betting, manage the run and void a match. Nothing here writes a result.
            </p>
            <ul className="space-y-2">
              {OPERATIONS.map((op) => (
                <li key={op.action}>
                  <GuardedButton
                    permission="fixtures:operate"
                    variant="secondary"
                    full
                    className="justify-start"
                    leadingIcon={op.icon}
                    blockedReason={op.blocked(f)}
                    onClick={() => ask({ title: `${op.label}?`, description: `${label}. ${op.consequence}`, confirmLabel: op.label, tone: op.tone, run: (reason) => operate.mutateAsync({ action: op.action, reason }) })}
                  >
                    {op.label}
                  </GuardedButton>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Exposure" description="From the risk service" actions={can("risk:read") ? <Link to="/risk" className="rounded-xs text-sm font-medium text-brand hover:underline focus-ring">Risk</Link> : undefined}>
            {!can("risk:read") ? (
              <EmptyState compact title="Not included in your role" description="Exposure needs the “risk:read” permission." />
            ) : exposure.data === undefined ? (
              exposure.error !== null ? (
                <ErrorState error={exposure.error} compact onRetry={() => void exposure.refetch()} />
              ) : (
                <SkeletonRows rows={2} />
              )
            ) : book === undefined ? (
              <EmptyState compact title="Not on the exposure board" description="The risk service lists no open liability for this match." />
            ) : (
              <dl className="grid grid-cols-2 gap-3">
                <DetailItem label="Accepted bets">{formatCount(book.bets)}</DetailItem>
                <DetailItem label="Exposure status">
                  <Status value={book.status} />
                </DetailItem>
                <DetailItem label="Total stake">
                  <span className="type-financial">{formatMoney(book.totalStake)}</span>
                </DetailItem>
                <DetailItem label="Worst-case exposure">
                  <span className="type-financial">{formatMoney(book.worstCaseExposure)}</span>
                </DetailItem>
              </dl>
            )}
          </Panel>

          <Panel title="Simulation state">
            {!can("simulation:read") ? (
              <EmptyState compact title="Not included in your role" description="Runs need the “simulation:read” permission." />
            ) : run === undefined ? (
              simulation.error !== null ? (
                <ErrorState error={simulation.error} compact onRetry={() => void simulation.refetch()} />
              ) : simulation.isPending ? (
                <SkeletonRows rows={2} />
              ) : (
                <EmptyState compact title="No run listed" description="The platform lists no simulation run for this match yet." />
              )
            ) : (
              <dl className="grid grid-cols-2 gap-3">
                <DetailItem label="Simulation ID" className="col-span-2">
                  <Mono className="whitespace-normal break-all text-text-primary">{run.id}</Mono>
                </DetailItem>
                <DetailItem label="Status">
                  <Status value={run.status} />
                </DetailItem>
                <DetailItem label="Events generated">{formatCount(run.events)}</DetailItem>
                <DetailItem label="Seed" className="col-span-2">
                  {run.status !== "COMPLETED" || run.seed === null ? <span className="text-sm text-text-muted">Withheld until the match is completed</span> : <Mono className="whitespace-normal break-all">{run.seed}</Mono>}
                </DetailItem>
                {run.error !== undefined && (
                  <DetailItem label="Run error" className="col-span-2">
                    <span className="text-sm text-text-secondary">{run.error}</span>
                  </DetailItem>
                )}
              </dl>
            )}
          </Panel>

          <Panel title="Live events" flush actions={disconnected && match !== undefined ? <StaleBadge updatedAt={live.syncedAt} /> : undefined}>
            <ErrorBoundary scope="feature">{match === undefined ? <SkeletonRows rows={4} className="p-4" /> : <MatchTimeline match={match} events={match.events} limit={12} className="max-h-80 overflow-y-auto scrollbar-thin" />}</ErrorBoundary>
          </Panel>

          {match?.stats !== undefined && (
            <Panel title="Statistics">
              <ErrorBoundary scope="feature">
                <StatsPanel match={match} stats={match.stats} />
              </ErrorBoundary>
            </Panel>
          )}

          {can("audit:read") && (
            <Panel title="Audit history" flush>
              {audit.data === undefined ? (
                audit.error !== null ? (
                  <ErrorState error={audit.error} compact onRetry={() => void audit.refetch()} />
                ) : (
                  <SkeletonRows rows={3} className="p-4" />
                )
              ) : audit.data.items.length === 0 ? (
                <EmptyState compact title="No operator actions" description="Nothing has been done to this match by hand." />
              ) : (
                <ActivityFeed
                  items={audit.data.items.map((e) => ({
                    id: e.id,
                    title: (
                      <>
                        <span className="font-medium">{e.actorName}</span> <span className="mono-id">{e.action}</span>
                      </>
                    ),
                    detail: recordedReason(e.after) ?? e.resource,
                    time: formatKickoffTime(e.timestamp),
                    tone: e.severity === "CRITICAL" ? ("danger" as const) : e.severity === "WARNING" ? ("warning" as const) : ("neutral" as const),
                  }))}
                />
              )}
            </Panel>
          )}
        </div>
      </div>
      {dialog}
    </>
  );
}
