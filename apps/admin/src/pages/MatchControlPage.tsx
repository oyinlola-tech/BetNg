import { Link, useParams } from "react-router";
import { Ban, ChevronLeft, DoorClosed, DoorOpen, Play, RotateCcw, ShieldCheck } from "lucide-react";
import type { AdminFixture, MatchAdminAction } from "@betng/contracts";
import { formatDateTime, formatMoney } from "@betng/ui-core";
import { ActivityFeed, EmptyState, ErrorState, LoadingState, MatchTimeline, Panel, RankedBars, Scoreboard, SkeletonRows, StatsPanel, StatusBadge } from "@betng/ui-web";
import { Field, Mono, Status } from "../components/Bits";
import { GuardedButton } from "../components/Guard";
import { MarketsBoard } from "../components/MarketsBoard";
import { PageHeader } from "../components/PageHeader";
import { useReasonAction } from "../components/ReasonAction";
import { useAdminAction, useAuditLog, useFixture, useMarketOdds, useSettlements, useSimulations } from "../hooks/queries";
import { useAdmin } from "../hooks/useAdmin";
import { useLiveMatch } from "../hooks/useLiveMatch";
import { adminSource } from "../services/sources";

interface Operation {
  readonly action: MatchAdminAction;
  readonly label: string;
  readonly icon: React.ReactNode;
  readonly tone: "primary" | "danger";
  readonly consequence: string;
  readonly blocked: (f: AdminFixture) => string | undefined;
}

const OPERATIONS: readonly Operation[] = [
  {
    action: "OPEN_BETTING",
    label: "Reopen betting",
    icon: <DoorOpen className="size-4" />,
    tone: "primary",
    consequence: "Markets accept bets again until the scheduled close before kick-off.",
    blocked: (f) => (f.bettingStatus === "SUSPENDED" ? undefined : "Available only while betting is suspended by an operator"),
  },
  {
    action: "CLOSE_BETTING",
    label: "Suspend betting",
    icon: <DoorClosed className="size-4" />,
    tone: "danger",
    consequence: "Every market on this match stops taking bets. Bets already placed stand.",
    blocked: (f) => (f.bettingStatus === "OPEN" ? undefined : "Betting is not open on this match"),
  },
  {
    action: "START_SIMULATION",
    label: "Prepare run now",
    icon: <Play className="size-4" />,
    tone: "primary",
    consequence: "The queued run is handed to the simulation service ahead of the scheduler. The service still draws the result.",
    blocked: (f) => (f.simulationStatus === "QUEUED" && f.matchStatus !== "SCHEDULED" ? undefined : "Available for a queued run once betting has opened"),
  },
  {
    action: "RERUN_SIMULATION",
    label: "Re-queue failed run",
    icon: <RotateCcw className="size-4" />,
    tone: "primary",
    consequence: "The failed preparation is queued again with the same inputs. A completed result can never be re-run.",
    blocked: (f) => (f.simulationStatus === "FAILED" ? undefined : "Available only when the run has failed"),
  },
  {
    action: "VOID_MATCH",
    label: "Void match",
    icon: <Ban className="size-4" />,
    tone: "danger",
    consequence: "The match is cancelled, every bet on it is voided and stakes are refunded at settlement. This cannot be undone.",
    blocked: (f) => (f.matchStatus === "CANCELLED" ? "This match is already void" : f.settlementStatus === "COMPLETED" ? "Settled matches cannot be voided here" : undefined),
  },
];

export function MatchControlPage(): React.JSX.Element {
  const { matchId } = useParams();
  const { can } = useAdmin();
  const fixture = useFixture(matchId);
  const live = useLiveMatch(matchId);
  const odds = useMarketOdds(matchId, can("odds:read"));
  const simulations = useSimulations();
  const settlements = useSettlements();
  const audit = useAuditLog({ resource: matchId ?? "", pageSize: 10 }, can("audit:read") && matchId !== undefined);
  const { ask, dialog } = useReasonAction();
  const operate = useAdminAction({
    run: (input: { readonly action: MatchAdminAction; readonly reason: string }) => adminSource.matchAction(matchId ?? "", input),
    success: (_, input) => `${OPERATIONS.find((o) => o.action === input.action)?.label ?? "Action"} applied`,
  });

  if (fixture.data === undefined) return fixture.error !== null ? <ErrorState error={fixture.error} onRetry={() => void fixture.refetch()} /> : <LoadingState label="Loading match" />;

  const f = fixture.data;
  const match = live.match;
  const label = `${f.homeName} v ${f.awayName}`;
  const run = simulations.data?.find((s) => s.matchId === f.matchId);
  const matchSettlements = settlements.data?.filter((s) => s.matchLabel === label);
  const stake = odds.data?.reduce((acc, m) => acc + m.selections.reduce((a, s) => a + s.stake, 0), 0) ?? 0;
  const exposure = odds.data?.reduce((acc, m) => acc + m.exposure, 0) ?? 0;

  return (
    <>
      <PageHeader
        eyebrow={
          <Link to="/matches" className="inline-flex items-center gap-1 rounded-xs hover:text-text-primary focus-ring">
            <ChevronLeft className="size-3.5" /> Matches
          </Link>
        }
        title={label}
        description={`${f.leagueName} · Season ${String(f.season)} · Matchday ${String(f.matchday)} · ${formatDateTime(f.kickoffAt)}`}
        actions={
          <StatusBadge tone={live.connection === "CONNECTED" ? "success" : live.connection === "OFFLINE" ? "danger" : "warning"} pulse={live.connection !== "CONNECTED" && live.connection !== "OFFLINE"}>
            {live.connection === "CONNECTED" ? "Live feed connected" : live.connection === "OFFLINE" ? "Feed offline" : "Feed reconnecting"}
          </StatusBadge>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Panel>
            {match === undefined ? <SkeletonRows rows={3} /> : <Scoreboard match={match} size="md" />}
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 md:grid-cols-4">
              <Field label="Betting">
                <Status value={f.bettingStatus} />
              </Field>
              <Field label="Match">
                <Status value={f.matchStatus} />
              </Field>
              <Field label="Simulation">
                <Status value={f.simulationStatus} />
              </Field>
              <Field label="Settlement">
                <Status value={f.settlementStatus} />
              </Field>
            </dl>
          </Panel>

          <section aria-labelledby="markets-heading">
            <h2 id="markets-heading" className="caps-label mb-2">
              Markets
            </h2>
            {can("odds:read") ? <MarketsBoard markets={odds.data} loading={odds.isLoading} error={odds.error} onRetry={() => void odds.refetch()} mode="odds" linkMatches={false} showMatchHeader={false} /> : <Panel><EmptyState compact title="Markets hidden" description="Your role does not include “odds:read”." /></Panel>}
          </section>

          <Panel title="Settlement" flush>
            {matchSettlements === undefined ? (
              <SkeletonRows rows={3} className="p-4" />
            ) : matchSettlements.length === 0 ? (
              <EmptyState compact title={f.settlementStatus === "NOT_DUE" ? "Not due yet" : "No settlements recorded"} description={f.settlementStatus === "NOT_DUE" ? "Bets settle a few seconds after full time." : "No bet on this match is in the settlement window."} />
            ) : (
              <ul className="divide-y divide-border">
                {matchSettlements.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-base">
                    <Mono className="w-28">{s.id}</Mono>
                    <span className="min-w-32 flex-1 truncate text-text-secondary">{s.owner}</span>
                    <span className="tabular text-text-muted">stake {formatMoney(s.stake)}</span>
                    <span className="w-28 text-right font-medium tabular">{formatMoney(s.payout)}</span>
                    <span className="w-24">
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
              Results come only from the simulation service. This console can pause betting, manage the run and void a match; it has no control that sets a score or picks a winner.
            </p>
            <ul className="space-y-2">
              {OPERATIONS.map((op) => (
                <li key={op.action}>
                  <GuardedButton
                    permission="fixtures:operate"
                    variant={op.tone === "danger" ? "secondary" : "secondary"}
                    full
                    className="justify-start"
                    icon={op.icon}
                    blockedReason={op.blocked(f)}
                    onClick={() => ask({ title: `${op.label}?`, description: `${label}. ${op.consequence}`, confirmLabel: op.label, tone: op.tone, run: (reason) => operate.mutateAsync({ action: op.action, reason }) })}
                  >
                    {op.label}
                  </GuardedButton>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Exposure">
            <dl className="mb-4 grid grid-cols-2 gap-3">
              <Field label="Total stake">
                <span className="font-display text-lg font-semibold tabular">{formatMoney(stake)}</span>
              </Field>
              <Field label="Worst-case exposure">
                <span className="font-display text-lg font-semibold tabular">{formatMoney(exposure)}</span>
              </Field>
            </dl>
            {odds.data !== undefined && odds.data.length > 0 && (
              <RankedBars title="Exposure by market" formatValue={formatMoney} items={[...odds.data].sort((a, b) => b.exposure - a.exposure).slice(0, 5).map((m) => ({ key: m.marketId, label: m.marketLabel, value: m.exposure }))} />
            )}
          </Panel>

          <Panel title="Simulation state">
            {run === undefined ? (
              <p className="text-sm text-text-muted">{simulations.isLoading ? "Loading run…" : can("simulation:read") ? "No run in the operating window." : "Your role does not include “simulation:read”."}</p>
            ) : (
              <dl className="grid grid-cols-2 gap-3">
                <Field label="Run">
                  <Mono className="text-text-primary">{run.id}</Mono>
                </Field>
                <Field label="Status">
                  <Status value={run.status} />
                </Field>
                <Field label="Seed">
                  <Mono>{run.seed}</Mono>
                </Field>
                <Field label="Events released">{run.events}</Field>
                {run.error !== undefined && (
                  <Field label="Error" className="col-span-2">
                    <span className="text-sm text-danger">{run.error}</span>
                  </Field>
                )}
              </dl>
            )}
          </Panel>

          <Panel title="Live events" flush>
            {match === undefined ? <SkeletonRows rows={4} className="p-4" /> : <MatchTimeline match={match} events={match.events} limit={12} className="max-h-80 overflow-y-auto scrollbar-thin" />}
          </Panel>

          {match?.stats !== undefined && (
            <Panel title="Statistics">
              <StatsPanel match={match} stats={match.stats} />
            </Panel>
          )}

          {can("audit:read") && (
            <Panel title="Audit history" flush>
              {audit.data === undefined ? (
                <SkeletonRows rows={3} className="p-4" />
              ) : audit.data.items.length === 0 ? (
                <EmptyState compact title="No operator actions" description="Nothing has been done to this match by hand." />
              ) : (
                <ActivityFeed items={audit.data.items.map((e) => ({ id: e.id, title: <><span className="font-medium">{e.actorName}</span> <span className="mono-id">{e.action}</span></>, detail: typeof (e.after as { reason?: unknown } | undefined)?.reason === "string" ? (e.after as { reason: string }).reason : undefined, time: new Date(e.timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }), tone: e.severity === "CRITICAL" ? "danger" : "warning" }))} />
              )}
            </Panel>
          )}
        </div>
      </div>
      {dialog}
    </>
  );
}
