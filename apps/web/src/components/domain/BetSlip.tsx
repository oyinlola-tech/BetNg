import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Receipt, Trash2, X } from "lucide-react";
import {
  QUICK_STAKES,
  STAKE_LIMITS,
  formatMoney,
  formatMoneyCompact,
  formatOdds,
  parseStakeInput,
  slipTotals,
  validateSlip,
} from "@betng/ui-core";
import { usePlaceBet, useWallet } from "../../hooks/queries";
import { cn } from "../../lib/cn";
import { presentError } from "../../lib/errors";
import { useToast } from "../../providers/ToastProvider";
import { useBetSlip } from "../../stores/betslip.store";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/States";

export function BetSlip({
  className,
  onPlaced,
}: {
  readonly className?: string;
  readonly onPlaced?: () => void;
}): React.JSX.Element {
  const { selections, stake, remove, clear, setStake } = useBetSlip();
  const wallet = useWallet();
  const placeBet = usePlaceBet();
  const { toast } = useToast();
  const [stakeText, setStakeText] = useState(() => (stake / 100).toString());

  const totals = useMemo(
    () => slipTotals(selections, stake),
    [selections, stake],
  );
  const available = wallet.data?.available ?? Number.POSITIVE_INFINITY;
  const problem = validateSlip(selections, stake, available);

  const updateStake = (text: string): void => {
    setStakeText(text);
    setStake(parseStakeInput(text));
  };

  const submit = async (): Promise<void> => {
    try {
      const bet = await placeBet.mutateAsync({ selections, stake });

      toast({
        tone: "success",
        title: "Simulated bet placed",
        message: `${String(bet.legs.length)} selection${bet.legs.length === 1 ? "" : "s"} · returns ${formatMoney(bet.potentialPayout)}`,
      });
      clear();
      onPlaced?.();
    } catch (error) {
      const p = presentError(error);

      toast({ tone: "danger", title: p.title, message: p.message });
    }
  };

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Receipt className="size-4 text-text-muted" aria-hidden />
          <h2 className="text-md font-semibold">Bet slip</h2>
          {selections.length > 0 && (
            <span className="rounded-xs bg-brand-subtle px-1.5 text-xs font-bold tabular text-brand">
              {selections.length}
            </span>
          )}
        </div>
        {selections.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 rounded-xs text-sm font-medium text-text-muted hover:text-danger focus-ring"
          >
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
              <Link
                to="/virtuals"
                className="text-sm font-semibold text-brand hover:underline"
              >
                Browse markets
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {selections.map((s) => (
              <li
                key={s.selectionId}
                className="flex items-start gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold">
                    {s.selectionLabel}
                  </p>
                  <p className="truncate text-sm text-text-secondary">
                    {s.marketName}
                  </p>
                  <p className="truncate text-xs text-text-muted">
                    {s.matchLabel} · {s.leagueCode}
                  </p>
                </div>
                <span className="text-base font-bold tabular">
                  {formatOdds(s.odds)}
                </span>
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
            ))}
          </ul>
        )}
      </div>

      {selections.length > 0 && (
        <div className="border-t border-border bg-surface px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">
              {selections.length === 1
                ? "Single"
                : `${String(selections.length)}-fold accumulator`}
            </span>
            <span className="font-semibold tabular">
              Total odds {formatOdds(totals.totalOdds)}
            </span>
          </div>

          <label className="mt-3 block">
            <span className="caps-label">Stake (simulated ₦)</span>
            <div
              className={cn(
                "mt-1 flex h-11 items-center rounded-sm border bg-surface-sunken focus-within:border-brand",
                problem !== undefined && problem !== "EMPTY"
                  ? "border-danger"
                  : "border-border",
              )}
            >
              <span className="pl-3 text-md text-text-muted">₦</span>
              <input
                inputMode="decimal"
                value={stakeText}
                onChange={(e) => {
                  updateStake(e.target.value);
                }}
                aria-label="Stake in naira"
                className="h-full w-full bg-transparent px-2 text-lg font-semibold tabular outline-none"
              />
            </div>
          </label>
          <div className="mt-2 flex gap-1.5">
            {QUICK_STAKES.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  updateStake((q / 100).toString());
                }}
                className={cn(
                  "h-7 flex-1 rounded-xs border text-xs font-semibold tabular focus-ring",
                  stake === q
                    ? "border-brand bg-brand-subtle text-brand"
                    : "border-border bg-surface text-text-secondary hover:bg-surface-hover",
                )}
              >
                {formatMoneyCompact(q)}
              </button>
            ))}
          </div>

          {problem === "BELOW_MIN" && (
            <p className="mt-2 text-sm text-danger">
              Minimum stake is {formatMoney(STAKE_LIMITS.min)}.
            </p>
          )}
          {problem === "ABOVE_MAX" && (
            <p className="mt-2 text-sm text-danger">
              Maximum stake is {formatMoney(STAKE_LIMITS.max)}.
            </p>
          )}
          {problem === "INSUFFICIENT" && (
            <p className="mt-2 text-sm text-danger">
              Exceeds your available balance.{" "}
              <Link to="/wallet" className="font-semibold underline">
                Top up
              </Link>
            </p>
          )}

          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between text-text-secondary">
              <dt>Potential profit</dt>
              <dd className="tabular">
                {formatMoney(Math.max(0, totals.potentialProfit))}
              </dd>
            </div>
            <div className="flex justify-between text-md font-semibold">
              <dt>Potential return</dt>
              <dd className="tabular">{formatMoney(totals.potentialReturn)}</dd>
            </div>
          </dl>

          <Button
            full
            size="lg"
            className="mt-3"
            loading={placeBet.isPending}
            disabled={problem !== undefined}
            onClick={() => void submit()}
          >
            Place simulated bet
          </Button>
          <p className="mt-2 text-center text-xs text-text-muted">
            Play-money only. No real funds are involved.
          </p>
        </div>
      )}
    </div>
  );
}
