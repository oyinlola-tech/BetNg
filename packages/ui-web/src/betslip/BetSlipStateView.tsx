import {
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  LoaderCircle,
  Lock,
  Receipt,
  TriangleAlert,
} from "lucide-react";
import type { StateTone } from "@betng/design-tokens";
import { formatMoney } from "@betng/ui-core";
import { TONE_SUBTLE } from "../domain/tone";
import { cn } from "../lib/cn";
import { BetReceipt } from "./BetReceipt";
import { rejectionText, type BetSlipState } from "./betSlipState";

type Icon = React.ComponentType<{
  readonly className?: string;
  readonly "aria-hidden"?: boolean;
}>;

const PRESENTATION: Readonly<
  Record<
    BetSlipState["kind"],
    { readonly title: string; readonly tone: StateTone; readonly Icon: Icon }
  >
> = {
  EMPTY: { title: "Your bet slip is empty", tone: "neutral", Icon: Receipt },
  SUBMITTING: { title: "Placing your bet", tone: "info", Icon: LoaderCircle },
  ACCEPTED: { title: "Bet accepted", tone: "success", Icon: CircleCheck },
  PARTIALLY_ACCEPTED: {
    title: "Bet partially accepted",
    tone: "warning",
    Icon: CircleAlert,
  },
  LIMITED: { title: "Stake limited", tone: "warning", Icon: CircleAlert },
  REJECTED: { title: "Bet not accepted", tone: "danger", Icon: CircleX },
  SUSPENDED: { title: "Betting suspended", tone: "suspended", Icon: Lock },
  EXPIRED: { title: "Bet slip expired", tone: "muted", Icon: Clock },
  ERROR: { title: "Something went wrong", tone: "danger", Icon: TriangleAlert },
};

function describe(state: BetSlipState): string | undefined {
  switch (state.kind) {
    case "EMPTY":
      return "Pick a price to add a selection.";
    case "SUBMITTING":
      return "Waiting for the platform to confirm.";
    case "ACCEPTED":
      return undefined;
    case "PARTIALLY_ACCEPTED":
      return (
        state.message ??
        (state.rejectedCount === undefined
          ? "Some selections were not accepted."
          : `${String(state.rejectedCount)} ${state.rejectedCount === 1 ? "selection was" : "selections were"} not accepted.`)
      );
    case "LIMITED":
      return (
        state.message ??
        (state.maxStake === undefined
          ? "The platform accepted a lower stake than you entered."
          : `The most you can stake on this bet is ${formatMoney(state.maxStake)}.`)
      );
    case "REJECTED":
      return state.message ?? rejectionText(state.reason, state.maxStake);
    case "SUSPENDED":
      return (
        state.message ?? "Bets cannot be placed right now. Your selections are kept."
      );
    case "EXPIRED":
      return (
        state.message ?? "The submission timed out before it was confirmed. Check your bets before trying again."
      );
    case "ERROR":
      return (
        state.message ?? "The bet could not be sent. Nothing has been placed."
      );
  }
}

export interface BetSlipStateViewProps {
  readonly state: BetSlipState;
  readonly action?: React.ReactNode;
  readonly className?: string | undefined;
}

export function BetSlipStateView({
  state,
  action,
  className,
}: BetSlipStateViewProps): React.JSX.Element {
  const { title, tone, Icon } = PRESENTATION[state.kind];
  const description = describe(state);
  const bet =
    state.kind === "ACCEPTED" || state.kind === "PARTIALLY_ACCEPTED"
      ? state.bet
      : undefined;
  const urgent = state.kind === "REJECTED" || state.kind === "ERROR";

  return (
    <div
      role={urgent ? "alert" : "status"}
      aria-busy={state.kind === "SUBMITTING" || undefined}
      data-state={state.kind}
      className={cn("flex flex-col items-center px-4 py-6 text-center", className)}
    >
      <span
        className={cn(
          "flex size-10 items-center justify-center rounded-md",
          TONE_SUBTLE[tone],
        )}
      >
        <Icon
          aria-hidden
          className={cn("size-5", state.kind === "SUBMITTING" && "animate-spin")}
        />
      </span>
      <p className="type-h3 mt-3 text-text-primary">{title}</p>
      {description !== undefined && (
        <p className="type-small mt-1 max-w-xs text-text-secondary">
          {description}
        </p>
      )}
      {bet !== undefined && <BetReceipt bet={bet} className="mt-4 w-full text-left" />}
      {action !== undefined && <div className="mt-4">{action}</div>}
    </div>
  );
}
