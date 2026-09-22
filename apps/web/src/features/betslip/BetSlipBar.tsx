import { useMemo } from "react";
import { useLocation } from "react-router";
import { ChevronUp, Ticket } from "lucide-react";
import { formatMoney, slipTotals } from "@betng/ui-core";
import { BottomSheet, cn } from "@betng/ui-web";
import { analytics } from "../../services/analytics";
import { useBetSlip } from "../../stores/betslip.store";
import { BetSlipPanel } from "./BetSlipPanel";
import { useSlipOutcome } from "./outcome.store";

export interface BetSlipBarProps {
  readonly className?: string;
}

/** The compact summary for small screens. The shell decides where it sticks; it renders nothing while the slip is empty. */
export function BetSlipBar({ className }: BetSlipBarProps): React.JSX.Element | null {
  const selections = useBetSlip((s) => s.selections);
  const stake = useBetSlip((s) => s.stake);
  const open = useBetSlip((s) => s.open);
  const setOpen = useBetSlip((s) => s.setOpen);
  const busy = useSlipOutcome((s) => s.submitting || s.outcome !== undefined);
  const totals = useMemo(() => slipTotals(selections, stake), [selections, stake]);
  const count = selections.length;
  const onSlipPage = useLocation().pathname === "/betslip";

  const close = (): void => {
    setOpen(false);
  };

  if (count === 0 && !busy && !open) return null;

  return (
    <>
      {count > 0 && !onSlipPage && (
        <div className={cn("border-t border-border bg-surface-elevated px-3 py-2 shadow-md", className)}>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => {
              analytics.track("bet_slip_opened", { surface: "sheet" });
              setOpen(true);
            }}
            className="flex h-11 w-full items-center gap-3 rounded-sm bg-brand px-3 text-left text-text-on-brand focus-ring"
          >
            <Ticket className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-base font-semibold">
              {count} {count === 1 ? "selection" : "selections"}
              <span aria-hidden> · </span>
              <span className="sr-only">, </span>
              <span className="font-medium">Est. return</span>{" "}
              <span className="tabular">{formatMoney(totals.potentialReturn)}</span>
            </span>
            <span className="sr-only">Open bet slip</span>
            <ChevronUp className="size-4 shrink-0" aria-hidden />
          </button>
        </div>
      )}
      <BottomSheet open={open} onClose={close} title="Bet slip">
        <BetSlipPanel heading={false} onDone={close} />
      </BottomSheet>
    </>
  );
}
