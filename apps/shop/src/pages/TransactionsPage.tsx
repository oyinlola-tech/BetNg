import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import type { ShopTransaction, ShopTransactionType } from "@betng/contracts";
import { formatMoney, formatSignedMoney } from "@betng/ui-core";
import { Badge, DataTable, KpiCard, Panel, Select, cn, type Column } from "@betng/ui-web";
import { Guard } from "../components/Guard";
import { PageHeader } from "../components/PageHeader";
import { useTransactions } from "../hooks/queries";
import { localDateKey } from "../lib/ticket";

type TypeChoice = ShopTransactionType | "ALL";

const TYPE_LABEL: Readonly<Record<ShopTransactionType, { readonly label: string; readonly tone: "success" | "danger" | "warning" | "neutral" }>> = {
  TICKET_SALE: { label: "Sale", tone: "success" },
  TICKET_PAYOUT: { label: "Payout", tone: "danger" },
  TICKET_CANCEL: { label: "Cancellation", tone: "warning" },
  CASH_IN: { label: "Cash in", tone: "neutral" },
  CASH_OUT: { label: "Cash out", tone: "neutral" },
};

const DAYS = Array.from({ length: 14 }, (_, i) => {
  const key = localDateKey(-i);

  return { value: key, label: i === 0 ? "Today" : i === 1 ? "Yesterday" : new Date(`${key}T12:00:00`).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" }) };
});

function Transactions(): React.JSX.Element {
  const navigate = useNavigate();
  const [date, setDate] = useState(DAYS[0]?.value ?? localDateKey());
  const [type, setType] = useState<TypeChoice>("ALL");
  const ledger = useTransactions(date === localDateKey() ? undefined : date);
  const rows = useMemo(() => ledger.data?.filter((t) => type === "ALL" || t.type === type), [ledger.data, type]);
  const moneyIn = ledger.data?.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0);
  const moneyOut = ledger.data?.filter((t) => t.amount < 0).reduce((a, t) => a - t.amount, 0);

  const columns: readonly Column<ShopTransaction>[] = [
    { key: "time", header: "Time", cell: (t) => <span className="tabular text-text-secondary">{new Date(t.createdAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}</span>, sortValue: (t) => t.createdAt },
    { key: "type", header: "Type", cell: (t) => <Badge tone={TYPE_LABEL[t.type].tone}>{TYPE_LABEL[t.type].label}</Badge>, sortValue: (t) => t.type },
    { key: "ref", header: "Ticket", cell: (t) => <span className="font-mono font-semibold">{t.reference ?? "—"}</span> },
    { key: "cashier", header: "Cashier", hideBelow: "md", cell: (t) => <span className="text-text-secondary">{t.cashierName}</span>, sortValue: (t) => t.cashierName },
    { key: "note", header: "Note", hideBelow: "xl", cell: (t) => <span className="block max-w-64 truncate text-text-muted">{t.note ?? ""}</span> },
    { key: "amount", header: "Amount", numeric: true, cell: (t) => <span className={cn("font-semibold", t.amount < 0 ? "text-danger" : "text-success")}>{formatSignedMoney(t.amount)}</span>, sortValue: (t) => t.amount },
    { key: "float", header: "Float after", numeric: true, cell: (t) => formatMoney(t.balanceAfter) },
  ];

  return (
    <div className="mx-auto max-w-[88rem] p-4 lg:p-5">
      <PageHeader title="Transactions" description="Every movement of the shop float, newest first." />
      <section aria-label="Day totals" className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Money in" value={moneyIn === undefined ? undefined : formatMoney(moneyIn)} hint="Ticket sales" />
        <KpiCard label="Money out" value={moneyOut === undefined ? undefined : formatMoney(moneyOut)} hint="Payouts and cancellations" />
        <KpiCard label="Net movement" value={moneyIn === undefined || moneyOut === undefined ? undefined : formatSignedMoney(moneyIn - moneyOut)} emphasis />
        <KpiCard label="Entries" value={ledger.data === undefined ? undefined : String(ledger.data.length)} />
      </section>
      <Panel flush>
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <Select label="Day" size="sm" value={date} onChange={setDate} options={DAYS} />
          <Select label="Type" size="sm" value={type} onChange={setType} options={[{ value: "ALL", label: "All types" }, ...(["TICKET_SALE", "TICKET_PAYOUT", "TICKET_CANCEL"] as const).map((value) => ({ value, label: TYPE_LABEL[value].label }))]} />
        </div>
        <DataTable
          caption="Shop transactions"
          columns={columns}
          rows={rows}
          rowKey={(t) => t.id}
          loading={ledger.isPending}
          error={ledger.error}
          onRetry={() => void ledger.refetch()}
          pageSize={20}
          onRowClick={(t) => {
            if (t.reference !== undefined) void navigate(`/tickets/${t.reference}`);
          }}
          empty={{ title: "No transactions", description: "Nothing has moved the float on this day with that filter." }}
        />
      </Panel>
    </div>
  );
}

export function TransactionsPage(): React.JSX.Element {
  return (
    <Guard permission="transactions:read">
      <Transactions />
    </Guard>
  );
}
