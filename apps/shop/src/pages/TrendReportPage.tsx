import { useMemo } from "react";
import type { ShopDailyReport } from "@betng/contracts";
import { formatMoney, formatSignedMoney } from "@betng/ui-core";
import { BarChart, DataTable, ErrorState, KpiCard, Panel, Skeleton, TimeSeriesChart, type Column } from "@betng/ui-web";
import { Guard } from "../components/Guard";
import { PageHeader } from "../components/PageHeader";
import { useReportRange } from "../hooks/queries";
import { formatAxisMoney, localDateKey } from "../lib/ticket";

const DAYS = 14;

const shortDay = (key: string): string => new Date(`${key}T12:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short" });

function Trend({ measure }: { readonly measure: "sales" | "payouts" }): React.JSX.Element {
  const range = useReportRange(localDateKey(-(DAYS - 1)), localDateKey());
  const days = range.data;
  const sales = measure === "sales";
  const total = days?.reduce((a, d) => a + d[measure], 0);
  const best = useMemo(() => (days === undefined ? undefined : [...days].sort((a, b) => b[measure] - a[measure])[0]), [days, measure]);
  const labels = days?.map((d) => shortDay(d.date)) ?? [];

  const columns: readonly Column<ShopDailyReport>[] = [
    { key: "date", header: "Day", cell: (d) => <span className="font-medium">{new Date(`${d.date}T12:00:00`).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" })}</span>, sortValue: (d) => d.date },
    { key: "tickets", header: "Tickets", numeric: true, cell: (d) => d.ticketsSold, sortValue: (d) => d.ticketsSold },
    { key: "sales", header: "Sales", numeric: true, cell: (d) => formatMoney(d.sales), sortValue: (d) => d.sales },
    { key: "payouts", header: "Payouts", numeric: true, cell: (d) => formatMoney(d.payouts), sortValue: (d) => d.payouts },
    { key: "ratio", header: "Payout ratio", numeric: true, hideBelow: "md", cell: (d) => (d.sales === 0 ? "—" : `${((d.payouts / d.sales) * 100).toFixed(0)}%`), sortValue: (d) => (d.sales === 0 ? 0 : d.payouts / d.sales) },
    { key: "net", header: "Net", numeric: true, cell: (d) => <span className="font-semibold">{formatSignedMoney(d.net)}</span>, sortValue: (d) => d.net },
  ];

  return (
    <div className="mx-auto max-w-[88rem] p-4 lg:p-5">
      <PageHeader title={sales ? "Sales" : "Payouts"} description={`The last ${String(DAYS)} days at this shop. All amounts are simulated.`} />
      {range.isError && days === undefined ? (
        <ErrorState error={range.error} onRetry={() => void range.refetch()} />
      ) : (
        <>
          <section aria-label="Period totals" className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label={sales ? "Total sales" : "Total payouts"} value={total === undefined ? undefined : formatMoney(total)} hint={`${String(DAYS)} days`} emphasis />
            <KpiCard label="Daily average" value={total === undefined ? undefined : formatMoney(Math.round(total / DAYS))} />
            <KpiCard label={sales ? "Best day" : "Heaviest day"} value={best === undefined ? undefined : formatMoney(best[measure])} hint={best === undefined ? "" : shortDay(best.date)} />
            {sales ? (
              <KpiCard label="Tickets sold" value={days === undefined ? undefined : days.reduce((a, d) => a + d.ticketsSold, 0).toLocaleString()} />
            ) : (
              <KpiCard label="Payout ratio" value={days === undefined ? undefined : `${((days.reduce((a, d) => a + d.payouts, 0) / Math.max(1, days.reduce((a, d) => a + d.sales, 0))) * 100).toFixed(1)}%`} hint="Payouts ÷ sales" />
            )}
          </section>

          <Panel title={sales ? "Sales per day" : "Payouts against sales"} className="mb-4">
            {days === undefined ? (
              <Skeleton className="h-56" />
            ) : sales ? (
              <BarChart title="Sales per day" labels={labels} series={[{ key: "sales", label: "Sales", values: days.map((d) => d.sales) }]} formatValue={formatMoney} formatTick={formatAxisMoney} height={240} />
            ) : (
              <TimeSeriesChart
                title="Payouts against sales per day"
                labels={labels}
                series={[
                  { key: "sales", label: "Sales", values: days.map((d) => d.sales) },
                  { key: "payouts", label: "Payouts", values: days.map((d) => d.payouts) },
                ]}
                formatValue={formatMoney}
                formatTick={formatAxisMoney}
                height={240}
              />
            )}
          </Panel>

          <Panel title="By day" flush>
            <DataTable caption={`${sales ? "Sales" : "Payouts"} by day`} columns={columns} rows={days} rowKey={(d) => d.date} loading={range.isPending} initialSort={{ key: "date", direction: "desc" }} />
          </Panel>
        </>
      )}
    </div>
  );
}

export function TrendReportPage({ measure }: { readonly measure: "sales" | "payouts" }): React.JSX.Element {
  return (
    <Guard permission="reports:read">
      <Trend measure={measure} />
    </Guard>
  );
}
