import { CircleAlert, CircleCheck, Printer } from "lucide-react";
import type { CashierShift } from "@betng/contracts";
import { formatDateTime, formatMoney, formatSignedMoney } from "@betng/ui-core";
import { Button, Panel, cn } from "@betng/ui-web";
import { usePrintReceipt } from "../../hooks/usePrint";

export function discrepancyTone(discrepancy: number | undefined): { readonly label: string; readonly className: string } {
  if (discrepancy === undefined) return { label: "Awaiting the platform", className: "text-text-muted" };
  if (discrepancy === 0) return { label: "Balanced", className: "text-success" };

  return discrepancy < 0 ? { label: "Short", className: "text-danger" } : { label: "Over", className: "text-warning" };
}

/** Shows the platform's reconciliation of a closed shift. Nothing here is computed by the terminal. */
export function ShiftResult({ shift, children }: { readonly shift: CashierShift; readonly children?: React.ReactNode }): React.JSX.Element {
  const printer = usePrintReceipt();
  const tone = discrepancyTone(shift.discrepancy);
  const balanced = shift.discrepancy === 0;

  return (
    <Panel title="Shift closed" description={`${shift.cashierName} · ${formatDateTime(shift.openedAt)} to ${shift.closedAt === undefined ? "now" : formatDateTime(shift.closedAt)}`} className="max-w-xl">
      <div role="status" className="flex items-start gap-3">
        {balanced ? <CircleCheck className="mt-1 size-6 shrink-0 text-success" aria-hidden /> : <CircleAlert className={cn("mt-1 size-6 shrink-0", tone.className)} aria-hidden />}
        <div>
          <p className="caps-label">Discrepancy</p>
          <p className={cn("font-display text-4xl font-bold tabular", tone.className)} data-testid="platform-discrepancy">
            {shift.discrepancy === undefined ? "Pending" : formatSignedMoney(shift.discrepancy)}
          </p>
          <p className={cn("text-sm font-semibold uppercase tracking-caps", tone.className)}>{tone.label}</p>
        </div>
      </div>
      <dl className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-text-secondary">Expected cash</dt>
          <dd className="font-medium tabular">{formatMoney(shift.totals.expectedCash)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-text-secondary">Counted cash</dt>
          <dd className="font-medium tabular">{shift.countedCash === undefined ? "Pending" : formatMoney(shift.countedCash)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-text-secondary">Tickets sold</dt>
          <dd className="font-medium tabular">{shift.totals.ticketsSold}</dd>
        </div>
        {shift.discrepancyNote !== undefined && shift.discrepancyNote !== "" && (
          <div className="flex justify-between gap-4">
            <dt className="text-text-secondary">Note</dt>
            <dd className="text-right">{shift.discrepancyNote}</dd>
          </div>
        )}
      </dl>
      <p className="mt-3 text-sm text-text-muted">Expected cash, the counted total and the discrepancy are the platform's figures.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" loading={printer.printing} leadingIcon={<Printer className="size-4" />} onClick={() => { printer.print({ kind: "shift", shift }); }}>
          Print summary
        </Button>
        {children}
      </div>
    </Panel>
  );
}
