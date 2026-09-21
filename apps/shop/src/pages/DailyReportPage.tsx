import { useState } from "react";
import { Printer } from "lucide-react";
import type { ShopDailyReport } from "@betng/contracts";
import { formatMoney, formatSignedMoney } from "@betng/ui-core";
import { Button, DataTable, ErrorState, KpiCard, Panel, RankedBars, Select, type Column } from "@betng/ui-web";
import { Guard } from "../components/Guard";
import { PageHeader } from "../components/PageHeader";
import { useDailyReport } from "../hooks/queries";
import { localDateKey } from "../lib/ticket";
import { printPage } from "../services/printing";

const DAYS = Array.from({ length: 14 }, (_, i) => {
  const key = localDateKey(-i);

  return { value: key, label: i === 0 ? "Today" : i === 1 ? "Yesterday" : new Date(`${key}T12:00:00`).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" }) };
});

const CASHIER_COLUMNS: readonly Column<ShopDailyReport["byCashier"][number]>[] = [
  { key: "name", header: "Cashier", cell: (c) => <span className="font-medium">{c.cashierName}</span>, sortValue: (c) => c.cashierName },
  { key: "tickets", header: "Tickets", numeric: true, cell: (c) => c.ticketsSold, sortValue: (c) => c.ticketsSold },
  { key: "sales", header: "Sales", numeric: true, cell: (c) => formatMoney(c.sales), sortValue: (c) => c.sales },
  { key: "payouts", header: "Payouts", numeric: true, cell: (c) => formatMoney(c.payouts), sortValue: (c) => c.payouts },
  { key: "net", header: "Net", numeric: true, cell: (c) => <span className="font-semibold">{formatSignedMoney(c.sales - c.payouts)}</span>, sortValue: (c) => c.sales - c.payouts },
];

function DailyReport(): React.JSX.Element {
  const [date, setDate] = useState(localDateKey());
  const report = useDailyReport(date === localDateKey() ? undefined : date);
  const r = report.data;

  return (
    <div className="mx-auto max-w-[88rem] p-4 lg:p-5">
      <PageHeader
        title="Daily Report"
        description="One day of trading at this shop. All amounts are simulated."
        actions={
          <>
            <Select label="Day" size="sm" value={date} onChange={setDate} options={DAYS} />
            <Button
              variant="secondary"
              size="sm"
              icon={<Printer className="size-3.5" />}
              onClick={() => {
                printPage();
              }}
            >
              Print
            </Button>
          </>
        }
      />
      {report.isError && r === undefined ? (
        <ErrorState error={report.error} onRetry={() => void report.refetch()} />
      ) : (
        <>
          <section aria-label="Totals" className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <KpiCard label="Sales" value={r === undefined ? undefined : formatMoney(r.sales)} hint={r === undefined ? "" : `${String(r.ticketsSold)} tickets`} />
            <KpiCard label="Payouts" value={r === undefined ? undefined : formatMoney(r.payouts)} />
            <KpiCard label="Net position" value={r === undefined ? undefined : formatSignedMoney(r.net)} emphasis />
            <KpiCard label="Open tickets" value={r === undefined ? undefined : String(r.openTickets)} hint="Not yet settled" />
            <KpiCard label="Cancellations" value={r === undefined ? undefined : String(r.cancellations)} />
          </section>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <Panel title="By cashier" flush>
              <DataTable caption="Sales and payouts by cashier" columns={CASHIER_COLUMNS} rows={r?.byCashier} rowKey={(c) => c.cashierId} loading={report.isPending} initialSort={{ key: "sales", direction: "desc" }} empty={{ title: "No sales on this day" }} />
            </Panel>
            <Panel title="Sales by competition">
              {r === undefined ? null : r.byLeague.length === 0 ? <p className="py-6 text-center text-sm text-text-muted">No sales on this day.</p> : <RankedBars title="Sales by competition" items={r.byLeague.map((l) => ({ key: l.leagueName, label: l.leagueName, value: l.sales, detail: `${String(l.ticketsSold)} tickets` }))} formatValue={formatMoney} />}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

export function DailyReportPage(): React.JSX.Element {
  return (
    <Guard permission="reports:read">
      <DailyReport />
    </Guard>
  );
}
