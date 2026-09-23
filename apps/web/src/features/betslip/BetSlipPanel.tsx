import { useMemo } from "react";
import { Link } from "react-router";
import { Gauge, LoaderCircle, Trash2, WifiOff } from "lucide-react";
import {
  STAKE_LIMITS,
  formatMoney,
  slipTotals,
  validateSlip,
  type BetPlacementView,
  type SlipSelection,
  type StakeProblem,
} from "@betng/ui-core";
import {
  BetReceipt,
  BetSlipSelection,
  BetSlipStateView,
  BetSlipSummary,
  Button,
  ErrorBoundary,
  ErrorHelp,
  cn,
  errorHelpTopic,
  presentError,
  rejectionHelpTopic,
  useOnline,
  type BetSlipSelectionStatus,
} from "@betng/ui-web";
import { useWallet } from "../../hooks/accountQueries";
import { useSlipPrices, type SlipPriceStatus } from "../../hooks/useSlipPrices";
import { getRuntimeConfig, logger } from "../../services/runtime";
import { useBetSlip } from "../../stores/betslip.store";
import { useAuth } from "../auth/useAuth";
import { ResponsibleGamingBanner } from "../limits/ResponsibleGamingBanner";
import { useLimitsSummary } from "../limits/limitQueries";
import { stakeLimitWarning } from "../limits/LimitsStatus";
import { useSlipOutcome, type SlipOutcome } from "./outcome.store";
import { StakeField } from "./StakeField";
import { useSlipSubmission } from "./useSlipSubmission";

export interface BetSlipPanelProps {
  /** `plain` (default) fills a rail or sheet that already has a frame; `card` draws its own. */
  readonly variant?: "card" | "plain";
  /** False when the surrounding surface already carries the "Bet slip" title, as a sheet does. */
  readonly heading?: boolean;
  /** Called when the customer leaves a finished submission or follows a link out of the slip. */
  readonly onDone?: () => void;
  readonly className?: string;
}

function toDisplayStatus(
  status: SlipPriceStatus | undefined,
  rejected: boolean,
): BetSlipSelectionStatus {
  if (rejected) return { kind: "CLOSED" };
  if (status === undefined) return { kind: "OK" };

  return status.kind === "UNAVAILABLE" ? { kind: "CLOSED" } : status;
}

function stakeLimits(): { readonly min: number; readonly max: number } {
  return getRuntimeConfig()?.stakeLimits ?? STAKE_LIMITS;
}

function problemText(
  problem: StakeProblem,
  limits: { readonly min: number; readonly max: number },
  onLeave: (() => void) | undefined,
): React.ReactNode {
  if (problem === "BELOW_MIN") return `The minimum stake is ${formatMoney(limits.min)}.`;
  if (problem === "ABOVE_MAX") return `The maximum stake is ${formatMoney(limits.max)}.`;

  if (problem === "INSUFFICIENT") {
    return (
      <>
        Your available balance does not cover this stake.{" "}
        <Link to="/wallet" onClick={onLeave} className="underline underline-offset-2">
          Go to wallet
        </Link>
      </>
    );
  }

  return undefined;
}

const LINK_BUTTON =
  "inline-flex h-10 items-center justify-center rounded-sm border border-border-strong bg-surface px-4 text-base font-semibold text-text-primary hover:bg-surface-hover focus-ring";

function PlacedView({
  placement,
  requestedStake,
  onDone,
}: {
  readonly placement: BetPlacementView;
  readonly requestedStake: number;
  readonly onDone: () => void;
}): React.JSX.Element {
  const { bet, outcome } = placement;

  const actions = (
    <div className="flex flex-wrap justify-center gap-2">
      {bet !== undefined && (
        <Link to={`/tickets/${bet.id}`} onClick={onDone} className={LINK_BUTTON}>
          View ticket
        </Link>
      )}
      <Button onClick={onDone}>Done</Button>
    </div>
  );

  if (outcome === "LIMITED") {
    return (
      <div>
        <BetSlipStateView
          state={{
            kind: "LIMITED",
            message:
              bet === undefined
                ? placement.message
                : `You entered ${formatMoney(requestedStake)}. The platform accepted ${formatMoney(bet.stake)}.`,
          }}
        />
        {bet !== undefined && (
          <div className="px-4">
            <dl className="mb-3 grid grid-cols-2 gap-3 rounded-sm border border-border p-3">
              <div>
                <dt className="type-caption">Stake entered</dt>
                <dd className="type-financial text-left text-text-secondary">
                  <s>{formatMoney(requestedStake)}</s>
                </dd>
              </div>
              <div>
                <dt className="type-caption">Stake accepted</dt>
                <dd className="type-financial text-left text-text-primary">{formatMoney(bet.stake)}</dd>
              </div>
            </dl>
            <BetReceipt bet={bet} />
          </div>
        )}
        <div className="px-4 py-4">{actions}</div>
      </div>
    );
  }

  return (
    <BetSlipStateView
      state={
        outcome === "PARTIALLY_ACCEPTED"
          ? {
              kind: "PARTIALLY_ACCEPTED",
              bet,
              rejectedCount: placement.rejectedSelectionIds?.length,
              message: placement.message,
            }
          : { kind: "ACCEPTED", bet }
      }
      action={actions}
    />
  );
}

function RefusedNotice({
  placement,
  selections,
  onUseMaxStake,
  onRemoveRejected,
  onReviewPrices,
  onLeave,
}: {
  readonly placement: BetPlacementView;
  readonly selections: readonly SlipSelection[];
  readonly onUseMaxStake: (maxStake: number) => void;
  readonly onRemoveRejected: (ids: readonly string[]) => void;
  readonly onReviewPrices: () => void;
  readonly onLeave: (() => void) | undefined;
}): React.JSX.Element {
  const { maxStake, reason } = placement;
  const rejected = (placement.rejectedSelectionIds ?? []).filter((id) =>
    selections.some((s) => s.selectionId === id),
  );

  return (
    <BetSlipStateView
      className="border-t border-border"
      state={{ kind: "REJECTED", reason, maxStake, message: placement.message }}
      action={
        <div className="flex flex-wrap justify-center gap-2">
          {maxStake !== undefined && (
            <Button
              onClick={() => {
                onUseMaxStake(maxStake);
              }}
            >
              Use {formatMoney(maxStake)}
            </Button>
          )}
          {rejected.length > 0 && (
            <Button
              variant="secondary"
              onClick={() => {
                onRemoveRejected(rejected);
              }}
            >
              Remove closed selections
            </Button>
          )}
          {reason === "ODDS_CHANGED" && (
            <Button variant="secondary" onClick={onReviewPrices}>
              Review prices
            </Button>
          )}
          {reason === "INSUFFICIENT_FUNDS" && (
            <Link to="/wallet" onClick={onLeave} className={LINK_BUTTON}>
              Go to wallet
            </Link>
          )}
          <ErrorHelp topic={rejectionHelpTopic(reason)} className="basis-full justify-center" />
        </div>
      }
    />
  );
}

function blockedMessage(count: number): string {
  return count === 1
    ? "One selection cannot be bet on right now. Remove it, or wait for the market to reopen. Your selections are kept."
    : `${String(count)} selections cannot be bet on right now. Remove them, or wait for the markets to reopen. Your selections are kept.`;
}

function outcomeAllowsEditing(outcome: SlipOutcome | undefined): boolean {
  return outcome === undefined || outcome.kind === "REFUSED" || outcome.kind === "FAILED";
}

function SlipBody({ variant = "plain", heading = true, onDone, className }: BetSlipPanelProps): React.JSX.Element {
  const selections = useBetSlip((s) => s.selections);
  const stake = useBetSlip((s) => s.stake);
  const { remove, removeMany, acceptOdds, clear, setStake } = useBetSlip.getState();
  const outcome = useSlipOutcome((s) => s.outcome);
  const setOutcome = useSlipOutcome((s) => s.setOutcome);
  const { isAuthenticated } = useAuth();
  const wallet = useWallet();
  const prices = useSlipPrices(selections);
  const { submitting, submit } = useSlipSubmission();
  const online = useOnline();
  const limitsSummary = useLimitsSummary();
  const restricted = isAuthenticated && limitsSummary.data?.restricted === true;

  const limits = stakeLimits();
  const totals = useMemo(() => slipTotals(selections, stake), [selections, stake]);
  const available = isAuthenticated
    ? (wallet.data?.available ?? Number.POSITIVE_INFINITY)
    : Number.POSITIVE_INFINITY;
  const problem = validateSlip(selections, stake, available, limits);
  const rejectedIds = outcome?.kind === "REFUSED" ? (outcome.placement.rejectedSelectionIds ?? []) : [];
  const blocked = prices.blocked.length > 0;
  const changed = prices.changed.length > 0;
  const editable = outcomeAllowsEditing(outcome) && !submitting;

  const edit = (change: () => void): void => {
    setOutcome(undefined);
    change();
  };

  const frame = cn(
    "flex min-h-0 flex-col",
    variant === "card" ? "rounded-md border border-border bg-surface" : "h-full",
    className,
  );

  const count = selections.length;

  const header =
    !heading && (count === 0 || !editable) ? null : (
      <header className={cn("flex shrink-0 items-center justify-between gap-2 border-b border-border px-4", heading ? "py-3" : "py-1.5")}>
        <div className="flex min-w-0 items-center gap-2">
          {heading ? (
            <>
              <h2 className="type-h3">Bet slip</h2>
              {count > 0 && (
                <span className="rounded-xs bg-brand-subtle px-1.5 text-xs font-bold tabular text-brand">
                  <span className="sr-only">Selections: </span>
                  {count}
                </span>
              )}
            </>
          ) : (
            <p className="type-small font-semibold text-text-secondary">
              {count} {count === 1 ? "selection" : "selections"}
            </p>
          )}
          {count > 0 && prices.checking && (
            <span role="status" className="type-small inline-flex items-center gap-1 text-text-muted">
              <LoaderCircle className="size-3 animate-spin" aria-hidden />
              Checking prices
            </span>
          )}
        </div>
        {count > 0 && editable && (
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<Trash2 className="size-3.5" aria-hidden />}
            onClick={() => {
              edit(clear);
            }}
          >
            Clear all
          </Button>
        )}
      </header>
    );

  if (submitting) {
    return (
      <section aria-label="Bet slip" className={frame}>
        {header}
        <BetSlipStateView state={{ kind: "SUBMITTING" }} />
      </section>
    );
  }

  if (outcome?.kind === "PLACED") {
    return (
      <section aria-label="Bet slip" className={frame}>
        {header}
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          <PlacedView
            placement={outcome.placement}
            requestedStake={outcome.requestedStake}
            onDone={() => {
              setOutcome(undefined);
              onDone?.();
            }}
          />
        </div>
      </section>
    );
  }

  if (outcome?.kind === "EXPIRED") {
    return (
      <section aria-label="Bet slip" className={frame}>
        {header}
        <BetSlipStateView
          state={{ kind: "EXPIRED", message: outcome.placement.message }}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link
                to="/tickets"
                onClick={() => {
                  setOutcome(undefined);
                  onDone?.();
                }}
                className={LINK_BUTTON}
              >
                Check my tickets
              </Link>
              <Button
                onClick={() => {
                  setOutcome(undefined);
                }}
              >
                Back to slip
              </Button>
            </div>
          }
        />
      </section>
    );
  }

  if (count === 0) {
    return (
      <section aria-label="Bet slip" className={frame}>
        {header}
        <BetSlipStateView state={{ kind: "EMPTY" }} />
      </section>
    );
  }

  const failure = outcome?.kind === "FAILED" ? outcome : undefined;
  const limitWarning = isAuthenticated && problem === undefined ? stakeLimitWarning(limitsSummary.data, stake) : undefined;

  return (
    <section aria-label="Bet slip" className={frame}>
      {header}
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        <ul aria-label="Selections" className="divide-y divide-border px-4">
          {selections.map((selection) => (
            <BetSlipSelection
              key={selection.selectionId}
              selection={selection}
              status={toDisplayStatus(
                prices.statuses.get(selection.selectionId),
                rejectedIds.some((id) => id === selection.selectionId),
              )}
              onRemove={(target) => {
                edit(() => {
                  remove(target.selectionId);
                });
              }}
            />
          ))}
        </ul>
        {outcome?.kind === "REFUSED" && (
          <RefusedNotice
            placement={outcome.placement}
            selections={selections}
            onLeave={onDone}
            onUseMaxStake={(maxStake) => {
              edit(() => {
                setStake(maxStake);
              });
            }}
            onRemoveRejected={(ids) => {
              edit(() => {
                removeMany(ids);
              });
            }}
            onReviewPrices={() => {
              setOutcome(undefined);
              prices.refresh();
            }}
          />
        )}
        {failure !== undefined && (
          <BetSlipStateView
            className="border-t border-border"
            state={{
              kind: "ERROR",
              message: failure.retryable
                ? `${presentError(failure.error).message} Nothing is placed twice: trying again sends the same submission.`
                : presentError(failure.error).message,
            }}
            action={<ErrorHelp topic={errorHelpTopic(presentError(failure.error).code)} />}
          />
        )}
        {blocked && outcome === undefined && (
          <BetSlipStateView
            className="border-t border-border"
            state={{ kind: "SUSPENDED", message: blockedMessage(prices.blocked.length) }}
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  edit(() => {
                    removeMany(prices.blocked);
                  });
                }}
              >
                Remove unavailable selections
              </Button>
            }
          />
        )}
      </div>
      <footer className="shrink-0 space-y-3 border-t border-border px-4 py-3">
        {restricted && <ResponsibleGamingBanner />}
        {!online && (
          <p role="status" className="type-small flex items-start gap-2 rounded-sm border border-border bg-surface-sunken px-3 py-2 text-text-secondary">
            <WifiOff className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
            You are offline. Bets are never queued: reconnect to place this one. Your selections are kept.
          </p>
        )}
        <StakeField
          stake={stake}
          max={limits.max}
          error={problemText(problem, limits, onDone)}
          onStake={(next) => {
            edit(() => {
              setStake(next);
            });
          }}
        />
        {limitWarning !== undefined && (
          <p role="status" data-testid="slip-limit-warning" className="type-small flex items-start gap-2 text-text-secondary">
            <Gauge className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
            {limitWarning}
          </p>
        )}
        <BetSlipSummary totals={totals} />
        {changed && !blocked ? (
          <Button
            fullWidth
            size="lg"
            onClick={() => {
              edit(() => {
                acceptOdds(prices.changed);
              });
            }}
          >
            Accept new prices
          </Button>
        ) : (
          <Button
            fullWidth
            size="lg"
            disabled={problem !== undefined || blocked || restricted}
            onClick={submit}
          >
            {failure !== undefined ? "Try again" : isAuthenticated ? "Place bet" : "Sign in to place bet"}
          </Button>
        )}
        <p className="type-small text-center text-text-muted">18+. Bet responsibly.</p>
      </footer>
    </section>
  );
}

export function BetSlipPanel(props: BetSlipPanelProps): React.JSX.Element {
  return (
    <ErrorBoundary
      scope="feature"
      onError={(error) => {
        logger.error("ui", "Bet slip failed to render", { error });
      }}
    >
      <SlipBody {...props} />
    </ErrorBoundary>
  );
}
