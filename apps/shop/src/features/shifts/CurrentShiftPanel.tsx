import { useState } from "react";
import { Link } from "react-router";
import { ArrowDownToLine, ArrowUpFromLine, DoorClosed, Printer } from "lucide-react";
import type { CashMovementRequest, CashierShift } from "@betng/contracts";
import { formatDateTime, formatMoney } from "@betng/ui-core";
import { Button, KpiCard, Panel, StatusBadge } from "@betng/ui-web";
import { usePrintReceipt } from "../../hooks/usePrint";
import { useShopSession } from "../../hooks/useShopSession";
import { CashMovementDialog } from "./CashMovementDialog";

export function CurrentShiftPanel({ shift }: { readonly shift: CashierShift }): React.JSX.Element {
  const { can } = useShopSession();
  const printer = usePrintReceipt();
  const [movement, setMovement] = useState<CashMovementRequest["type"] | undefined>();
  const t = shift.totals;
  const canMoveCash = can("cash:move");

  return (
    <>
      <Panel
        title="Current shift"
        description={`${shift.cashierName} · opened ${formatDateTime(shift.openedAt)}`}
        actions={<StatusBadge tone="success">Open</StatusBadge>}
      >
        <section aria-label="Shift totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Opening float" value={formatMoney(t.openingFloat)} />
          <KpiCard label="Sales" value={formatMoney(t.sales)} hint={`${String(t.ticketsSold)} ticket${t.ticketsSold === 1 ? "" : "s"} sold`} />
          <KpiCard label="Payouts" value={formatMoney(t.payouts)} />
          <KpiCard label="Cancellations" value={formatMoney(t.cancellations)} />
          <KpiCard label="Cash in" value={formatMoney(t.cashIn)} />
          <KpiCard label="Cash out" value={formatMoney(t.cashOut)} />
          <KpiCard label="Expected cash" value={formatMoney(t.expectedCash)} hint="What the drawer should hold" emphasis className="col-span-2" />
        </section>
        <p className="mt-3 text-sm text-text-muted">Totals come from the platform ledger and refresh as you sell and pay.</p>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
          <Button variant="secondary" disabled={!canMoveCash} leadingIcon={<ArrowDownToLine className="size-4" />} onClick={() => { setMovement("CASH_IN"); }}>
            Cash in
          </Button>
          <Button variant="secondary" disabled={!canMoveCash} leadingIcon={<ArrowUpFromLine className="size-4" />} onClick={() => { setMovement("CASH_OUT"); }}>
            Cash out
          </Button>
          <Button variant="secondary" loading={printer.printing} leadingIcon={<Printer className="size-4" />} onClick={() => { printer.print({ kind: "shift", shift }); }}>
            Print summary
          </Button>
          <Link to="/cashier/shift/close" className="ml-auto inline-flex h-10 items-center gap-2 rounded-sm bg-brand px-4 text-base font-semibold text-text-on-brand focus-ring">
            <DoorClosed className="size-4" aria-hidden />
            Close shift
          </Link>
        </div>
        {!canMoveCash && <p className="mt-2 text-sm text-text-muted">Cash in and cash out need a manager.</p>}
      </Panel>

      <CashMovementDialog
        type={movement}
        onClose={() => {
          setMovement(undefined);
        }}
      />
    </>
  );
}
