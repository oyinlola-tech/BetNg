import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Lock, ReceiptText, RefreshCw, Trash2, TriangleAlert, X } from "lucide-react";
import { QUICK_STAKES, STAKE_LIMITS, formatKickoffTime, formatMoney, formatMoneyCompact, formatOdds, parseStakeInput, slipTotals, validateSlip } from "@betng/ui-core";
import { Button, EmptyState, Input, Modal, cn, presentError, useToast } from "@betng/ui-web";
import { usePlaceTicket } from "../hooks/queries";
import { useShortcuts } from "../hooks/useShortcuts";
import { useSlipWatch } from "../hooks/useSlipWatch";
import { useSlip } from "../stores/slip.store";
import { Kbd } from "./Kbd";

const NO_WALLET = Number.MAX_SAFE_INTEGER;

const STAKE_MESSAGE = {
  BELOW_MIN: `Minimum stake is ${formatMoney(STAKE_LIMITS.min)}.`,
  ABOVE_MAX: `Maximum stake is ${formatMoney(STAKE_LIMITS.max)}.`,
} as const;

export function SlipPanel({ className }: { readonly className?: string }): React.JSX.Element {
  const { selections, stake, customerName, customerPhone, remove, clear, setStake, setCustomer, reprice, setOpen } = useSlip();
  const watch = useSlipWatch(selections);
  const place = usePlaceTicket();
  const navigate = useNavigate();
  const client = useQueryClient();
  const { toast } = useToast();
  const [stakeText, setStakeText] = useState(() => String(stake / 100));
  const [reviewing, setReviewing] = useState(false);
  const stakeRef = useRef<HTMLInputElement>(null);

  const totals = useMemo(() => slipTotals(selections, stake), [selections, stake]);
  const problem = validateSlip(selections, stake, NO_WALLET);
  const stakeError = problem === "BELOW_MIN" || problem === "ABOVE_MAX" ? STAKE_MESSAGE[problem] : undefined;
  const blocked = watch.priceChanges > 0 || watch.closed > 0;
  const ready = selections.length > 0 && problem === undefined && !blocked && !watch.updating;

  const bindings = useMemo(
    () => ({
      F8: () => {
        stakeRef.current?.focus();
        stakeRef.current?.select();
      },
      F9: () => {
        if (ready) setReviewing(true);
      },
    }),
    [ready],
  );

  useShortcuts(bindings);

  const applyStake = (value: number): void => {
    setStake(value);
    setStakeText(String(value / 100));
  };

  const submit = (): void => {
    place.mutate(
      { selections, stake, ...(customerName.trim() === "" ? {} : { customerName: customerName.trim() }), ...(customerPhone.trim() === "" ? {} : { customerPhone: customerPhone.trim() }) },
      {
        onSuccess: (ticket) => {
          setReviewing(false);
          clear();
          setOpen(false);
          toast({ tone: "success", title: `Ticket ${ticket.code} sold`, message: `${formatMoney(ticket.stake)} to return ${formatMoney(ticket.potentialPayout)}` });
          void navigate(`/tickets/${ticket.code}?sold=1`);
        },
        onError: () => {
          setReviewing(false);
          void client.invalidateQueries({ queryKey: ["markets"] });
        },
      },
    );
  };

  const state = selections.length === 0 ? "Empty" : place.isPending ? "Submitting" : place.isError ? "Failed" : watch.updating ? "Updating" : ready ? "Ready" : "Invalid";

  return (
    <section aria-label="Bet slip" className={cn("flex min-h-0 flex-col bg-surface", className)}>
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <ReceiptText className="size-4 text-text-muted" aria-hidden />
          Slip
          <span className="rounded-full bg-surface-sunken px-1.5 text-sm tabular text-text-secondary">{selections.length}</span>
        </h2>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-xs font-semibold uppercase tracking-caps",
              state === "Ready" && "text-success",
              state === "Invalid" && "text-warning",
              state === "Failed" && "text-danger",
              (state === "Empty" || state === "Updating" || state === "Submitting") && "text-text-muted",
            )}
            aria-live="polite"
          >
            {state}
          </span>
          {selections.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clear} icon={<Trash2 className="size-3.5" />}>
              Clear
            </Button>
          )}
        </div>
      </header>

      {selections.length === 0 ? (
        <EmptyState compact icon={<ReceiptText className="size-5" />} title="No selections" description="Pick a price from the match list. Each match can appear once per ticket." className="flex-1" />
      ) : (
        <>
          <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto scrollbar-thin">
            {selections.map((leg) => {
              const issue = watch.issues.get(leg.selectionId);

              return (
                <li key={leg.selectionId} className={cn("px-3 py-2", issue?.kind === "CLOSED" && "bg-danger-subtle/50", issue?.kind === "PRICE" && "bg-warning-subtle/50")}>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-text-primary">{leg.selectionLabel}</p>
                      <p className="truncate text-sm text-text-secondary">{leg.marketName}</p>
                      <p className="truncate text-sm text-text-muted">
                        {leg.matchLabel} · {leg.leagueCode} · {formatKickoffTime(leg.kickoffAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={cn("font-display text-md font-semibold tabular", issue?.kind === "PRICE" && "text-text-muted line-through")}>{formatOdds(leg.odds)}</p>
                      {issue?.kind === "PRICE" && issue.currentOdds !== undefined && <p className="font-display text-md font-semibold tabular text-warning">{formatOdds(issue.currentOdds)}</p>}
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${leg.selectionLabel}, ${leg.matchLabel}`}
                      onClick={() => {
                        remove(leg.selectionId);
                      }}
                      className="-mr-1 flex size-7 shrink-0 items-center justify-center rounded-xs text-text-muted hover:bg-surface-hover hover:text-danger focus-ring pointer-coarse:size-11"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  {issue?.kind === "CLOSED" && (
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-danger">
                      <Lock className="size-3.5" aria-hidden />
                      Betting closed. Remove this selection.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="shrink-0 space-y-3 border-t border-border p-3">
            {blocked && (
              <div role="alert" className="rounded-sm border border-warning/40 bg-warning-subtle p-2.5 text-sm">
                <p className="flex items-center gap-1.5 font-semibold text-text-primary">
                  <TriangleAlert className="size-4 text-warning" aria-hidden />
                  {watch.closed > 0 ? `${String(watch.closed)} selection${watch.closed === 1 ? " has" : "s have"} closed` : `${String(watch.priceChanges)} price${watch.priceChanges === 1 ? " has" : "s have"} changed`}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {watch.priceChanges > 0 && (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<RefreshCw className="size-3.5" />}
                      onClick={() => {
                        reprice(watch.prices);
                      }}
                    >
                      Accept new prices
                    </Button>
                  )}
                  {watch.closed > 0 && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        for (const [id, issue] of watch.issues) if (issue.kind === "CLOSED") remove(id);
                      }}
                    >
                      Remove closed
                    </Button>
                  )}
                </div>
              </div>
            )}

            {place.isError && (
              <div role="alert" className="rounded-sm border border-danger/30 bg-danger-subtle p-2.5 text-sm text-text-primary">
                <span className="font-semibold text-danger">{presentError(place.error).title}.</span> {place.error instanceof Error ? place.error.message : presentError(place.error).message}
              </div>
            )}

            <div>
              <Input
                ref={stakeRef}
                label="Stake"
                prefix="₦"
                inputMode="decimal"
                enterKeyHint="done"
                autoComplete="off"
                value={stakeText}
                error={stakeError}
                hint="F8 to focus"
                onFocus={(event) => {
                  event.target.select();
                }}
                onChange={(event) => {
                  setStakeText(event.target.value);
                  setStake(parseStakeInput(event.target.value));
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && ready) setReviewing(true);
                }}
              />
              <div className="mt-1.5 grid grid-cols-5 gap-1" role="group" aria-label="Quick stakes">
                {QUICK_STAKES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={stake === value}
                    onClick={() => {
                      applyStake(value);
                    }}
                    className={cn("h-8 rounded-xs border text-sm font-semibold tabular transition-colors focus-ring pointer-coarse:h-11", stake === value ? "border-brand bg-brand-subtle text-brand" : "border-border bg-surface text-text-secondary hover:bg-surface-hover")}
                  >
                    {formatMoneyCompact(value)}
                  </button>
                ))}
              </div>
            </div>

            <details className="group rounded-sm border border-border">
              <summary className="flex h-9 cursor-pointer list-none items-center justify-between rounded-sm px-2.5 text-sm font-medium text-text-secondary focus-ring [&::-webkit-details-marker]:hidden">
                Customer details <span className="text-text-muted group-open:hidden">{customerName === "" && customerPhone === "" ? "Optional" : customerName || customerPhone}</span>
              </summary>
              <div className="grid gap-2 p-2.5 pt-0">
                <Input
                  label="Name"
                  autoComplete="off"
                  maxLength={80}
                  value={customerName}
                  onChange={(event) => {
                    setCustomer({ customerName: event.target.value });
                  }}
                />
                <Input
                  label="Phone"
                  inputMode="tel"
                  autoComplete="off"
                  maxLength={20}
                  value={customerPhone}
                  onChange={(event) => {
                    setCustomer({ customerPhone: event.target.value });
                  }}
                />
              </div>
            </details>

            <dl className="space-y-1 text-base">
              <div className="flex justify-between">
                <dt className="text-text-secondary">{selections.length === 1 ? "Single" : `${String(selections.length)}-fold accumulator`}</dt>
                <dd className="font-display font-semibold tabular">{formatOdds(totals.totalOdds)}</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-text-secondary">Potential return</dt>
                <dd className="font-display text-xl font-semibold tabular text-text-primary">{formatMoney(totals.potentialReturn)}</dd>
              </div>
            </dl>

            <Button
              size="lg"
              full
              disabled={!ready}
              loading={place.isPending}
              onClick={() => {
                setReviewing(true);
              }}
            >
              Review ticket
              <Kbd className="ml-1 border-white/30 bg-white/15 text-text-on-brand">F9</Kbd>
            </Button>
          </div>
        </>
      )}

      <Modal
        open={reviewing}
        onClose={() => {
          if (!place.isPending) setReviewing(false);
        }}
        title="Confirm ticket"
        footer={
          <>
            <Button
              variant="ghost"
              disabled={place.isPending}
              onClick={() => {
                setReviewing(false);
              }}
            >
              Back to slip
            </Button>
            <Button autoFocus loading={place.isPending} onClick={submit} icon={<ArrowRight className="size-4" />}>
              Take {formatMoney(stake)} and issue ticket
            </Button>
          </>
        }
      >
        <ul className="divide-y divide-border rounded-sm border border-border">
          {selections.map((leg) => (
            <li key={leg.selectionId} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">{leg.selectionLabel}</p>
                <p className="truncate text-sm text-text-muted">
                  {leg.marketName} · {leg.matchLabel}
                </p>
              </div>
              <span className="font-display font-semibold tabular">{formatOdds(leg.odds)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-sm bg-surface-sunken p-2.5">
            <dt className="caps-label">Stake</dt>
            <dd className="mt-0.5 font-display text-lg font-semibold tabular">{formatMoney(stake)}</dd>
          </div>
          <div className="rounded-sm bg-surface-sunken p-2.5">
            <dt className="caps-label">Odds</dt>
            <dd className="mt-0.5 font-display text-lg font-semibold tabular">{formatOdds(totals.totalOdds)}</dd>
          </div>
          <div className="rounded-sm bg-surface-sunken p-2.5">
            <dt className="caps-label">Return</dt>
            <dd className="mt-0.5 font-display text-lg font-semibold tabular">{formatMoney(totals.potentialReturn)}</dd>
          </div>
        </dl>
        {(customerName !== "" || customerPhone !== "") && (
          <p className="mt-3 text-sm text-text-secondary">
            Customer: {customerName} {customerPhone}
          </p>
        )}
        <p className="mt-3 text-sm text-text-muted">Collect the stake before confirming. Prices are checked again when the ticket is issued.</p>
      </Modal>
    </section>
  );
}
