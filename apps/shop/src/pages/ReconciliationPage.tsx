import { useState } from "react";
import type { CashierShift } from "@betng/contracts";
import { formatDateTime, formatMoney, formatSignedMoney } from "@betng/ui-core";
import { DataTable, ErrorState, Panel, Select, StatusBadge, cn, type Column } from "@betng/ui-web";
import { Guard } from "../components/Guard";
import { PageHeader } from "../components/PageHeader";
import { discrepancyTone } from "../features/shifts/ShiftResult";
import { ShiftUnavailable } from "../features/shifts/ShiftUnavailable";
import { isNotImplemented, useShiftsEnabled } from "../features/shifts/useShiftsAvailable";
import { useShifts } from "../hooks/queries";
import { localDateKey } from "../lib/ticket";

const DAYS = Array.from({ length: 14 }, (_, i) => {
  const key = localDateKey(-i);

  return { value: key, label: i === 0 ? "Today" : i === 1 ? "Yesterday" : new Date(`${key}T12:00:00`).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" }) };
});

const STATUS_TONE = { OPEN: "success", CLOSING: "warning", CLOSED: "neutral", RECONCILED: "info" } as const;

const COLUMNS: readonly Column<CashierShift>[] = [
  { key: "cashier", header: "Cashier", cell: (s) => <span className="font-medium">{s.cashierName}</span>, sortValue: (s) => s.cashierName },
  { key: "status", header: "Status", cell: (s) => <StatusBadge tone={STATUS_TONE[s.status]}>{s.status.charAt(0) + s.status.slice(1).toLowerCase()}</StatusBadge>, sortValue: (s) => s.status },
  { key: "opened", header: "Opened", cell: (s) => formatDateTime(s.openedAt), sortValue: (s) => s.openedAt },
  { key: "closed", header: "Closed", cell: (s) => (s.closedAt === undefined ? "Open" : formatDateTime(s.closedAt)), sortValue: (s) => s.closedAt ?? "" },
  { key: "expected", header: "Expected", numeric: true, cell: (s) => formatMoney(s.totals.expectedCash), sortValue: (s) => s.totals.expectedCash },
  { key: "counted", header: "Counted", numeric: true, cell: (s) => (s.countedCash === undefined ? "Not counted" : formatMoney(s.countedCash)), sortValue: (s) => s.countedCash ?? -1 },
  {
    key: "discrepancy",
    header: "Discrepancy",
    numeric: true,
    cell: (s) => {
      const tone = discrepancyTone(s.discrepancy);

      return s.discrepancy === undefined ? <span className="text-text-muted">None yet</span> : <span className={cn("font-semibold", tone.className)}>{formatSignedMoney(s.discrepancy)} · {tone.label}</span>;
    },
    sortValue: (s) => s.discrepancy ?? 0,
  },
  { key: "note", header: "Note", cell: (s) => <span className="text-text-secondary">{s.discrepancyNote ?? ""}</span> },
];

function Reconciliation(): React.JSX.Element {
  const enabled = useShiftsEnabled();
  const [date, setDate] = useState(localDateKey());
  const shifts = useShifts(date, enabled);

  if (!enabled || isNotImplemented(shifts.error)) return <ShiftUnavailable />;

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Select label="Day" size="sm" value={date} onChange={setDate} options={DAYS} />
      </div>
      {shifts.isError && shifts.data === undefined ? (
        <ErrorState error={shifts.error} onRetry={() => void shifts.refetch()} />
      ) : (
        <Panel title="Shifts" flush>
          <DataTable caption="Cashier shifts with the platform's reconciliation" columns={COLUMNS} rows={shifts.data} rowKey={(s) => s.id} loading={shifts.isPending} initialSort={{ key: "opened", direction: "desc" }} empty={{ title: "No shifts on this day" }} />
        </Panel>
      )}
    </>
  );
}

export function ReconciliationPage(): React.JSX.Element {
  return (
    <Guard permission="reports:read">
      <div className="mx-auto max-w-[88rem] p-4 lg:p-5">
        <PageHeader title="Shift Reconciliation" description="Every cashier's shift for the day, with the expected cash, the count and the discrepancy as the platform recorded them." />
        <Reconciliation />
      </div>
    </Guard>
  );
}
