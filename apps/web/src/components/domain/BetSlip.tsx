import { useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowDown, ArrowUp, CheckCircle2, Loader2, Lock, Receipt, Trash2, TriangleAlert, X } from "lucide-react";
import {
  QUICK_STAKES,
  STAKE_LIMITS,
  formatMoney,
  formatMoneyCompact,
  formatOdds,
  parseStakeInput,
  slipTotals,
  validateSlip,
  type BetView,
} from "@betng/ui-core";
import { Badge, Button, cn, EmptyState, presentError } from "@betng/ui-web";
import { useAuth } from "../../features/auth";
import { usePlaceBet, useWallet } from "../../hooks/queries";
import { useSlipPrices } from "../../hooks/useSlipPrices";
import { useBetSlip } from "../../stores/betslip.store";

function PlacedState({ bet, onDone }: { readonly bet: BetView; readonly onDone: () => void }): React.JSX.Element {
  return (
    <div role="status" className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center animate-fade-in">
      <span className="flex size-12 items-center justify-center rounded-full bg-success-subtle text-success">
        <CheckCircle2 className="size-6" aria-hidden />
      </span>
      <p className="mt-3 text-lg font-semibold">Simulated bet placed</p>
      <p className="mt-1 text-sm text-text-secondary">
        {bet.legs.length === 1 ? "Single" : `${String(bet.legs.length)}-fold`} at {formatOdds(bet.totalOdds)} · stake {formatMoney(bet.stake)}
      </p>
      <p className="mt-3 text-sm text-text-muted">Potential return</p>
      <p className="font-display text-2xl font-semibold tabular">{formatMoney(bet.potentialPayout)}</p>
      <div className="mt-5 flex gap-2">
        <Link to="/history" onClick={onDone} className="inline-flex h-10 items-center rounded-sm border border-border-strong bg-surface px-4 text-base font-semibold hover:bg-surface-hover focus-ring">
          View my bets
        </Link>
        <Button onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}

export function BetSlip({
  className,
  onPlaced,
}: {
  readonly className?: string;
  readonly onPlaced?: () => void;
}): React.JSX.Element {
  const { selections, stake, remove, removeMany, acceptOdds, clear, setStake } = useBetSlip();
  const { isAuthenticated, requireAuth } = useAuth();
  const wallet = useWallet();
  const placeBet = usePlaceBet();
  const prices = useSlipPrices(selections);
  const [stakeText, setStakeText] = useState(() => (stake / 100).toString());
  const [placed, setPlaced] = useState<BetView>();
  const [failure, setFailure] = useState<unknown>();

  const totals = useMemo(() => slipTotals(selections, stake), [selections, stake]);
  const available = isAuthenticated ? (wallet.data?.available ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
  const problem = validateSlip(selections, stake, available);
  const hasSuspended = prices.suspended.length > 0;
  const hasChanges = prices.changed.length > 0;

  const updateStake = (text: string): void => {
    setStakeText(text);
    setStake(parseStakeInput(text));
    setFailure(undefined);
  };

  const submit = (): void => {
    setFailure(undefined);

    const slip = useBetSlip.getState();

    placeBet.mutate(
      { selections: slip.selections, stake: slip.stake },
      {
        onSuccess: (bet) => {
          setPlaced(bet);
          clear();
        },
        onError: setFailure,
      },
    );
  };

  if (placed !== undefined) {
    return (
      <div className={cn("flex h-full flex-col", className)}>
        <PlacedState
          bet={placed}
          onDone={() => {
            setPlaced(undefined);
            onPlaced?.();
          }}
        />
      </div>
    );
  }

  const failed = failure === undefined ? undefined : presentError(failure);

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Receipt className="size-4 text-text-muted" aria-hidden />
          <h2 className="text-md font-semibold">Bet slip</h2>
          {selections.length > 0 && <span className="rounded-xs bg-brand-subtle px-1.5 text-xs font-bold tabular text-brand">{selections.length}</span>}
          {selections.length > 0 && prices.updating && (
            <span className="inline-flex items-center gap-1 text-xs text-text-muted" role="status">
              <Loader2 className="size-3 animate-spin" aria-hidden />
              Checking prices
            </span>
          )}
        </div>
        {selections.length > 0 && (
          <button type="button" onClick={clear} className="inline-flex items-center gap-1 rounded-xs text-sm font-medium text-text-muted hover:text-danger focus-ring">
            <Trash2 className="size-3.5" aria-hidden />
            Clear all
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {selections.length === 0 ? (
          <EmptyState
            compact
            icon={<Receipt className="size-5" />}
            title="Your slip is empty"
            description="Tap any odds to add a selection. One selection per match."
            action={
              <Link to="/virtuals" className="text-sm font-semibold text-brand hover:underline">
                Browse markets
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {selections.map((s) => {
              const line = prices.lines.get(s.selectionId);
              const suspended = line?.state === "SUSPENDED";
              const current = line?.currentOdds;

              return (
                <li key={s.selectionId} className={cn("flex items-start gap-3 px-4 py-3", suspended && "bg-surface-sunken/60")}>
                  <div className={cn("min-w-0 flex-1", suspended && "opacity-60")}>
                    <p className="truncate text-base font-semibold">{s.selectionLabel}</p>
                    <p className="truncate text-sm text-text-secondary">{s.marketName}</p>
                    <p className="truncate text-xs text-text-muted">
                      {s.matchLabel} · {s.leagueCode}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    {suspended ? (
                      <Badge tone="warning">
                        <Lock className="size-2.5" aria-hidden />
                        Suspended
                      </Badge>
                    ) : current !== undefined ? (
                      <>
                        <span className={cn("inline-flex items-center gap-0.5 text-base font-bold tabular", current > s.odds ? "text-success" : "text-danger")}>
                          {current > s.odds ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />}
                          {formatOdds(current)}
                          <span className="sr-only">{current > s.odds ? "odds went up" : "odds went down"}</span>
                        </span>
                        <span className="text-xs tabular text-text-muted line-through">{formatOdds(s.odds)}</span>
                      </>
                    ) : (
                      <span className="text-base font-bold tabular">{formatOdds(s.odds)}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${s.selectionLabel}`}
                    onClick={() => {
                      remove(s.selectionId);
                    }}
                    className="-mr-1 rounded-xs p-1 text-text-muted hover:text-danger focus-ring"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selections.length > 0 && (
        <div className="border-t border-border bg-surface px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">{selections.length === 1 ? "Single" : `${String(selections.length)}-fold accumulator`}</span>
            <span className="font-semibold tabular">Total odds {formatOdds(totals.totalOdds)}</span>
          </div>

          <label className="mt-3 block">
            <span className="caps-label">Stake (simulated ₦)</span>
            <div className={cn("mt-1 flex h-11 items-center rounded-sm border bg-surface-sunken focus-within:border-brand", problem !== undefined && problem !== "EMPTY" ? "border-danger" : "border-border")}>
              <span className="pl-3 text-md text-text-muted">₦</span>
              <input
                inputMode="decimal"
                value={stakeText}
                disabled={placeBet.isPending}
                onChange={(e) => {
                  updateStake(e.target.value);
                }}
                aria-label="Stake in naira"
                aria-invalid={problem !== undefined && problem !== "EMPTY"}
                className="h-full w-full bg-transparent px-2 text-lg font-semibold tabular outline-none"
              />
            </div>
          </label>
          <div className="mt-2 flex gap-1.5">
            {QUICK_STAKES.map((q) => (
              <button
                key={q}
                type="button"
                disabled={placeBet.isPending}
                onClick={() => {
                  updateStake((q / 100).toString());
                }}
                className={cn(
                  "h-7 flex-1 rounded-xs border text-xs font-semibold tabular focus-ring",
                  stake === q ? "border-brand bg-brand-subtle text-brand" : "border-border bg-surface text-text-secondary hover:bg-surface-hover",
                )}
              >
                {formatMoneyCompact(q)}
              </button>
            ))}
          </div>

          <div aria-live="polite">
            {problem === "BELOW_MIN" && <p className="mt-2 text-sm text-danger">Minimum stake is {formatMoney(STAKE_LIMITS.min)}.</p>}
            {problem === "ABOVE_MAX" && <p className="mt-2 text-sm text-danger">Maximum stake is {formatMoney(STAKE_LIMITS.max)}.</p>}
            {problem === "INSUFFICIENT" && (
              <p className="mt-2 text-sm text-danger">
                Exceeds your available balance.{" "}
                <Link to="/wallet" className="font-semibold underline">
                  Top up
                </Link>
              </p>
            )}
          </div>

          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between text-text-secondary">
              <dt>Potential profit</dt>
              <dd className="tabular">{formatMoney(Math.max(0, totals.potentialProfit))}</dd>
            </div>
            <div className="flex justify-between text-md font-semibold">
              <dt>Potential return</dt>
              <dd className="tabular">{formatMoney(totals.potentialReturn)}</dd>
            </div>
          </dl>

          {failed !== undefined && (
            <div role="alert" className="mt-3 flex items-start gap-2 rounded-sm border border-danger/30 bg-danger-subtle px-3 py-2 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
              <p className="min-w-0 flex-1">
                <span className="font-semibold">{failed.title}.</span> <span className="text-text-secondary">{failed.message}</span>
              </p>
            </div>
          )}

          {hasSuspended ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-warning">
                {prices.suspended.length === 1 ? "One selection is" : `${String(prices.suspended.length)} selections are`} no longer open for betting.
              </p>
              <Button
                full
                size="lg"
                variant="secondary"
                onClick={() => {
                  removeMany(prices.suspended);
                }}
              >
                Remove suspended
              </Button>
            </div>
          ) : hasChanges ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-text-secondary">Odds changed since you added {prices.changed.length === 1 ? "a selection" : "these selections"}.</p>
              <Button
                full
                size="lg"
                onClick={() => {
                  acceptOdds(prices.changed);
                }}
              >
                Accept new odds
              </Button>
            </div>
          ) : (
            <Button
              full
              size="lg"
              className="mt-3"
              loading={placeBet.isPending}
              disabled={problem !== undefined}
              onClick={() => {
                requireAuth({ reason: "Log in to place this bet. Your slip stays as it is.", run: submit });
              }}
            >
              {placeBet.isPending ? "Placing…" : failed !== undefined ? "Try again" : isAuthenticated ? "Place simulated bet" : "Log in to place bet"}
            </Button>
          )}
          <p className="mt-2 text-center text-xs text-text-muted">Play-money only. No real funds are involved.</p>
        </div>
      )}
    </div>
  );
}
