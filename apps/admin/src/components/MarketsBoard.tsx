import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowDown, ArrowUp, Minus, Pause, Play } from "lucide-react";
import type { AdminMarketOdds, AdminSelectionOdds } from "@betng/contracts";
import { formatMoney, formatOdds } from "@betng/ui-core";
import { EmptyState, ErrorState, Panel, SkeletonRows, cn } from "@betng/ui-web";
import { useAdminAction } from "../hooks/queries";
import { formatPercent } from "../lib/format";
import { adminSource } from "../services/sources";
import { Status } from "./Bits";
import { GuardedButton } from "./Guard";
import { useReasonAction, type PendingAction } from "./ReasonAction";

function Movement({ selection }: { readonly selection: AdminSelectionOdds }): React.JSX.Element {
  const delta = selection.currentOdds - selection.openingOdds;

  if (Math.abs(delta) < 0.005) {
    return (
      <span className="inline-flex items-center gap-0.5 text-text-muted">
        <Minus className="size-3" aria-hidden />
        <span className="sr-only">unchanged</span>
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-0.5 tabular", delta > 0 ? "text-success" : "text-danger")}>
      {delta > 0 ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />}
      {Math.abs(delta).toFixed(2)}
      <span className="sr-only">{delta > 0 ? " drifted out" : " shortened"}</span>
    </span>
  );
}

function OddsCell({ value }: { readonly value: number }): React.JSX.Element {
  const previous = useRef(value);
  const [flash, setFlash] = useState(0);

  useEffect(() => {
    if (previous.current !== value) {
      previous.current = value;
      setFlash((n) => n + 1);
    }
  }, [value]);

  return (
    <span key={flash} className={cn("inline-block rounded-xs px-1 font-display font-semibold tabular", flash > 0 && "flash-cell")}>
      {formatOdds(value)}
    </span>
  );
}

const MarketBlock = memo(function MarketBlock({ market, mode, ask }: { readonly market: AdminMarketOdds; readonly mode: "markets" | "odds"; readonly ask: (action: PendingAction) => void }): React.JSX.Element {
  const action = useAdminAction({
    run: (input: { readonly action: "SUSPEND" | "RESUME"; readonly reason: string }) => adminSource.marketAction(market.marketId, input),
    success: (m) => `${m.marketLabel} ${m.status === "OPEN" ? "resumed" : "suspended"}`,
  });
  const open = market.status === "OPEN";
  const stake = market.selections.reduce((acc, s) => acc + s.stake, 0);

  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
        <p className="min-w-40 flex-1 text-base font-medium text-text-primary">{market.marketLabel}</p>
        <Status value={market.status} />
        <dl className="flex gap-4 text-sm">
          <div className="flex gap-1.5">
            <dt className="text-text-muted">Margin</dt>
            <dd className="tabular text-text-primary">{formatPercent(market.margin)}</dd>
          </div>
          <div className="hidden gap-1.5 sm:flex">
            <dt className="text-text-muted">Stake</dt>
            <dd className="tabular text-text-primary">{formatMoney(stake)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-text-muted">Exposure</dt>
            <dd className="tabular font-medium text-text-primary">{formatMoney(market.exposure)}</dd>
          </div>
        </dl>
        {market.status !== "SETTLED" && (
          <GuardedButton
            permission="odds:write"
            size="sm"
            variant={open ? "secondary" : "primary"}
            icon={open ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            onClick={() =>
              ask({
                title: open ? `Suspend ${market.marketLabel}?` : `Resume ${market.marketLabel}?`,
                description: open ? `No new bets are accepted on this market for ${market.matchLabel} until it is resumed. Placed bets are unaffected.` : `Bets are accepted again on this market for ${market.matchLabel}, at the current model prices.`,
                confirmLabel: open ? "Suspend market" : "Resume market",
                tone: open ? "danger" : "primary",
                run: (reason) => action.mutateAsync({ action: open ? "SUSPEND" : "RESUME", reason }),
              })
            }
          >
            {open ? "Suspend" : "Resume"}
          </GuardedButton>
        )}
      </div>
      {mode === "odds" && (
        <div className="overflow-x-auto px-4 pb-3 scrollbar-thin">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="caps-label text-[10px]">
                <th scope="col" className="py-1 font-semibold">Selection</th>
                <th scope="col" className="py-1 text-right font-semibold">Current</th>
                <th scope="col" className="py-1 text-right font-semibold">Opening</th>
                <th scope="col" className="py-1 text-right font-semibold">Move</th>
                <th scope="col" className="py-1 text-right font-semibold">Model prob.</th>
                <th scope="col" className="py-1 text-right font-semibold">Stake</th>
                <th scope="col" className="py-1 text-right font-semibold">Liability</th>
              </tr>
            </thead>
            <tbody>
              {market.selections.map((s) => (
                <tr key={s.selectionId} className="border-t border-border">
                  <th scope="row" className="py-1.5 font-medium text-text-primary">{s.label}</th>
                  <td className="py-1.5 text-right"><OddsCell value={s.currentOdds} /></td>
                  <td className="py-1.5 text-right tabular text-text-secondary">{formatOdds(s.openingOdds)}</td>
                  <td className="py-1.5 text-right"><Movement selection={s} /></td>
                  <td className="py-1.5 text-right tabular text-text-secondary">{formatPercent(s.modelProbability)}</td>
                  <td className="py-1.5 text-right tabular text-text-secondary">{formatMoney(s.stake)}</td>
                  <td className={cn("py-1.5 text-right tabular", s.liability === market.exposure && s.liability > 0 ? "font-semibold text-text-primary" : "text-text-secondary")}>{formatMoney(s.liability)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});

export function MarketsBoard({ markets, loading, error, onRetry, mode, linkMatches = true }: { readonly markets: readonly AdminMarketOdds[] | undefined; readonly loading: boolean; readonly error: unknown; readonly onRetry: () => void; readonly mode: "markets" | "odds"; readonly linkMatches?: boolean }): React.JSX.Element {
  const { ask, dialog } = useReasonAction();
  const byMatch = useMemo(() => {
    const groups = new Map<string, AdminMarketOdds[]>();

    for (const market of markets ?? []) groups.set(market.matchId, [...(groups.get(market.matchId) ?? []), market]);

    return [...groups.values()];
  }, [markets]);

  if (markets === undefined) return error !== null && error !== undefined && !loading ? <ErrorState error={error} onRetry={onRetry} /> : <SkeletonRows rows={8} />;
  if (byMatch.length === 0) return <EmptyState title="No markets trading" description="Markets appear when a matchday opens for betting and stay until full time." />;

  return (
    <div className="space-y-4">
      {byMatch.map((group) => {
        const first = group[0];

        if (first === undefined) return null;

        return (
          <Panel
            key={first.matchId}
            flush
            title={first.matchLabel}
            description={`${first.leagueName} · ${String(group.length)} markets · exposure ${formatMoney(group.reduce((acc, m) => acc + m.exposure, 0))}`}
            actions={
              linkMatches ? (
                <Link to={`/matches/${first.matchId}`} className="text-sm font-medium text-brand hover:underline focus-ring">
                  Match control
                </Link>
              ) : undefined
            }
          >
            {group.map((market) => (
              <MarketBlock key={market.marketId} market={market} mode={mode} ask={ask} />
            ))}
          </Panel>
        );
      })}
      {dialog}
    </div>
  );
}
