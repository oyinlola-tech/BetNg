import { useMemo, useState } from "react";
import { Download, RotateCcw } from "lucide-react";
import type { AdminSettlement, PlatformLedgerEntry, PlatformReportDay } from "@betng/contracts";
import { formatDateTime, formatMoney, formatSignedMoney } from "@betng/ui-core";
import { BarChart, Button, DataTable, KpiCard, Panel, Select, SkeletonRows, Tabs, cn, type Column } from "@betng/ui-web";
import { FilterBar, Mono, Status } from "../components/Bits";
import { GuardedButton } from "../components/Guard";
import { PageHeader } from "../components/PageHeader";
import { useReasonAction } from "../components/ReasonAction";
import { useAdminAction, useReportDays, useSettlements, useWalletOverview } from "../hooks/queries";
import { daysAgoKey, downloadCsv, formatMoneyShort, formatPercent, shortDay } from "../lib/format";
import { adminSource } from "../services/sources";

type SettlementTab = "PENDING" | "COMPLETED" | "FAILED" | "VOIDED";

export function SettlementPage(): React.JSX.Element {
  const settlements = useSettlements();
  const [tab, setTab] = useState<SettlementTab>("PENDING");
  const { ask, dialog } = useReasonAction();
  const retry = useAdminAction({ run: (input: { readonly id: string; readonly reason: string }) => adminSource.retrySettlement(input.id, input.reason), success: (s) => `${s.id} settled` });
  const count = (status: SettlementTab): number => settlements.data?.filter((s) => s.status === status).length ?? 0;
  const rows = useMemo(() => settlements.data?.filter((s) => s.status === tab), [settlements.data, tab]);

  const columns: readonly Column<AdminSettlement>[] = [
    { key: "bet", header: "Bet", cell: (s) => <Mono className="text-text-primary">{s.betId}</Mono> },
    { key: "ticket", header: "Ticket", cell: (s) => (s.ticketCode === undefined ? <span className="text-text-muted">—</span> : <Mono>{s.ticketCode}</Mono>), hideBelow: "md" },
    {
      key: "owner",
      header: "User / shop",
      sortValue: (s) => s.owner,
      cell: (s) => (
        <span className="whitespace-nowrap">
          <span className="mr-1.5 rounded-xs bg-surface-sunken px-1 py-0.5 text-[10px] font-semibold uppercase tracking-caps text-text-muted">{s.channel === "SHOP" ? "Shop" : "Online"}</span>
          {s.owner.replace(/^(user|shop):/, "")}
        </span>
      ),
    },
    { key: "match", header: "Match", sortValue: (s) => s.matchLabel, cell: (s) => <span className="whitespace-nowrap">{s.matchLabel}</span> },
    { key: "result", header: "Result", align: "center", cell: (s) => <span className="font-display font-semibold tabular">{s.result}</span> },
    { key: "stake", header: "Stake", numeric: true, sortValue: (s) => s.stake, cell: (s) => formatMoney(s.stake), hideBelow: "lg" },
    { key: "payout", header: "Payout", numeric: true, sortValue: (s) => s.payout, cell: (s) => <span className="font-medium">{formatMoney(s.payout)}</span> },
    {
      key: "status",
      header: "Settlement status",
      cell: (s) => (
        <span>
          <Status value={s.status} />
          {s.error !== undefined && <span className="mt-0.5 block max-w-56 text-sm text-danger">{s.error}</span>}
        </span>
      ),
    },
    { key: "time", header: "Timestamp", numeric: true, align: "left", sortValue: (s) => s.timestamp, cell: (s) => formatDateTime(s.timestamp), hideBelow: "lg" },
    ...(tab === "FAILED"
      ? [
          {
            key: "actions",
            header: "",
            align: "right" as const,
            cell: (s: AdminSettlement) => (
              <GuardedButton permission="settlement:operate" size="sm" variant="secondary" icon={<RotateCcw className="size-3.5" />} onClick={() => ask({ title: `Retry ${s.id}?`, description: `${s.matchLabel}, ${s.result}. The settlement service recalculates the bet from the recorded result and writes the ledger entry once.`, confirmLabel: "Retry settlement", run: (reason) => retry.mutateAsync({ id: s.id, reason }) })}>
                Retry
              </GuardedButton>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader title="Settlement" description="Bets settled from recorded results. A failed settlement can be retried; the outcome is recalculated from the result, never entered by hand." />
      <Tabs<SettlementTab>
        label="Settlement status"
        className="mb-4"
        value={tab}
        onChange={setTab}
        items={[
          { value: "PENDING", label: "Pending", count: count("PENDING") },
          { value: "COMPLETED", label: "Completed", count: count("COMPLETED") },
          { value: "FAILED", label: "Failed", count: count("FAILED") },
          { value: "VOIDED", label: "Voided", count: count("VOIDED") },
        ]}
      />
      <Panel flush>
        <DataTable caption="Settlements" columns={columns} rows={rows} rowKey={(s) => s.id} loading={settlements.isLoading} error={settlements.error} onRetry={() => void settlements.refetch()} pageSize={15} empty={{ title: tab === "PENDING" ? "Nothing waiting" : tab === "FAILED" ? "No failed settlements" : "Nothing here yet", description: tab === "PENDING" ? "Bets appear here for a few seconds after each full-time whistle." : "Settlements move here as the settlement service processes them." }} />
      </Panel>
      {dialog}
    </>
  );
}

export function WalletPage(): React.JSX.Element {
  const wallet = useWalletOverview();
  const w = wallet.data;
  const [type, setType] = useState("ALL");
  const rows = useMemo(() => w?.entries.filter((e) => type === "ALL" || e.type === type), [w, type]);

  const columns: readonly Column<PlatformLedgerEntry>[] = [
    { key: "time", header: "Time", numeric: true, align: "left", sortValue: (e) => e.createdAt, cell: (e) => formatDateTime(e.createdAt) },
    { key: "id", header: "Entry", cell: (e) => <Mono>{e.id}</Mono>, hideBelow: "md" },
    { key: "type", header: "Type", sortValue: (e) => e.type, cell: (e) => <span className="text-sm font-medium capitalize text-text-secondary">{e.type.toLowerCase()}</span> },
    { key: "owner", header: "Owner", sortValue: (e) => e.owner, cell: (e) => <span className="whitespace-nowrap">{e.owner.replace(/^(user|shop):/, "")}</span> },
    { key: "channel", header: "Channel", cell: (e) => <span className="text-text-secondary">{e.channel === "SHOP" ? "Shop" : "Online"}</span>, hideBelow: "md" },
    { key: "ref", header: "Reference", cell: (e) => <Mono>{e.reference ?? "—"}</Mono>, hideBelow: "lg" },
    { key: "amount", header: "Amount", numeric: true, sortValue: (e) => e.amount, cell: (e) => <span className={cn("font-medium", e.amount < 0 ? "text-text-primary" : "text-success")}>{formatSignedMoney(e.amount)}</span> },
  ];

  return (
    <>
      <PageHeader title="Wallet" description="Simulated money held across the platform and the most recent ledger movements. Read-only: balances change only through bets, settlements and cashier operations." />
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <KpiCard label="Customer balances" value={w === undefined ? undefined : formatMoneyShort(w.customerBalances)} />
          <KpiCard label="Shop floats" value={w === undefined ? undefined : formatMoneyShort(w.shopFloats)} />
          <KpiCard label="Reserved" value={w === undefined ? undefined : formatMoneyShort(w.reserved)} hint="against open bets" />
          <KpiCard label="Deposits today" value={w === undefined ? undefined : formatMoneyShort(w.todayDeposits)} />
          <KpiCard label="Withdrawals today" value={w === undefined ? undefined : formatMoneyShort(w.todayWithdrawals)} positiveIsGood={false} />
        </div>
        <Panel title="Ledger" flush>
          <FilterBar>
            <Select label="Entry type" size="sm" value={type} onChange={setType} options={[{ value: "ALL", label: "All types" }, ...["STAKE", "PAYOUT", "DEPOSIT", "WITHDRAWAL", "REFUND"].map((t) => ({ value: t, label: t.charAt(0) + t.slice(1).toLowerCase() }))]} />
          </FilterBar>
          <DataTable caption="Platform ledger" columns={columns} rows={rows} rowKey={(e) => e.id} loading={wallet.isLoading} error={wallet.error} onRetry={() => void wallet.refetch()} pageSize={15} empty={{ title: "No ledger entries" }} />
        </Panel>
      </div>
    </>
  );
}

type Range = "7" | "14" | "30";

export function ReportsPage(): React.JSX.Element {
  const [range, setRange] = useState<Range>("14");
  const reports = useReportDays(daysAgoKey(Number(range) - 1), daysAgoKey(0));
  const days = reports.data ?? [];
  const total = days.reduce((acc, d) => ({ stake: acc.stake + d.stake, payouts: acc.payouts + d.payouts, net: acc.net + d.net, bets: acc.bets + d.bets, online: acc.online + d.onlineStake, shop: acc.shop + d.shopStake }), { stake: 0, payouts: 0, net: 0, bets: 0, online: 0, shop: 0 });
  const ready = reports.data !== undefined;

  const columns: readonly Column<PlatformReportDay>[] = [
    { key: "date", header: "Date", sortValue: (d) => d.date, cell: (d) => <span className="whitespace-nowrap">{shortDay(d.date)}</span> },
    { key: "bets", header: "Bets", numeric: true, sortValue: (d) => d.bets, cell: (d) => d.bets.toLocaleString() },
    { key: "stake", header: "Stake", numeric: true, sortValue: (d) => d.stake, cell: (d) => formatMoney(d.stake) },
    { key: "online", header: "Online", numeric: true, sortValue: (d) => d.onlineStake, cell: (d) => formatMoney(d.onlineStake), hideBelow: "lg" },
    { key: "shop", header: "Shops", numeric: true, sortValue: (d) => d.shopStake, cell: (d) => formatMoney(d.shopStake), hideBelow: "lg" },
    { key: "payouts", header: "Payouts", numeric: true, sortValue: (d) => d.payouts, cell: (d) => formatMoney(d.payouts) },
    { key: "net", header: "Net", numeric: true, sortValue: (d) => d.net, cell: (d) => <span className={cn("font-medium", d.net < 0 && "text-danger")}>{formatMoney(d.net)}</span> },
    { key: "margin", header: "Hold", numeric: true, sortValue: (d) => d.net / (d.stake || 1), cell: (d) => formatPercent(d.net / (d.stake || 1)), hideBelow: "md" },
  ];

  return (
    <>
      <PageHeader
        title="Reports"
        description="Daily simulated trading across online and shops."
        actions={
          <>
            <Tabs<Range> label="Date range" variant="segmented" value={range} onChange={setRange} items={[{ value: "7", label: "7 days" }, { value: "14", label: "14 days" }, { value: "30", label: "30 days" }]} />
            <Button
              variant="secondary"
              icon={<Download className="size-4" />}
              disabled={days.length === 0}
              onClick={() => downloadCsv(`betng-daily-report-${daysAgoKey(0)}.csv`, ["date", "bets", "stake_ngn", "online_stake_ngn", "shop_stake_ngn", "payouts_ngn", "net_ngn"], days.map((d) => [d.date, d.bets, d.stake / 100, d.onlineStake / 100, d.shopStake / 100, d.payouts / 100, d.net / 100]))}
            >
              Export CSV
            </Button>
          </>
        }
      />
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Stake" value={ready ? formatMoneyShort(total.stake) : undefined} hint={`${total.bets.toLocaleString()} bets`} />
          <KpiCard label="Payouts" value={ready ? formatMoneyShort(total.payouts) : undefined} hint={ready ? `${formatPercent(total.payouts / (total.stake || 1))} of stake` : undefined} />
          <KpiCard label="Simulated net" value={ready ? formatMoneyShort(total.net) : undefined} hint={ready ? `${formatPercent(total.net / (total.stake || 1))} hold` : undefined} emphasis />
          <KpiCard label="Shop share" value={ready ? formatPercent(total.shop / (total.stake || 1)) : undefined} hint={ready ? `${formatMoneyShort(total.shop)} over the counter` : undefined} />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Stake, payouts and net" description={`Last ${range} days`}>
            {ready ? <BarChart title={`Stake, payouts and net for the last ${range} days`} labels={days.map((d) => shortDay(d.date))} series={[{ key: "stake", label: "Stake", values: days.map((d) => d.stake) }, { key: "payouts", label: "Payouts", values: days.map((d) => d.payouts) }, { key: "net", label: "Net", values: days.map((d) => d.net) }]} formatValue={formatMoneyShort} /> : <SkeletonRows rows={5} />}
          </Panel>
          <Panel title="Stake by channel" description="Online against shops">
            {ready ? <BarChart title="Stake by channel" labels={days.map((d) => shortDay(d.date))} series={[{ key: "online", label: "Online", values: days.map((d) => d.onlineStake) }, { key: "shop", label: "Shops", values: days.map((d) => d.shopStake) }]} formatValue={formatMoneyShort} /> : <SkeletonRows rows={5} />}
          </Panel>
        </div>
        <Panel title="Daily breakdown" flush>
          <DataTable caption="Daily report" columns={columns} rows={reports.data === undefined ? undefined : [...days].reverse()} rowKey={(d) => d.date} loading={reports.isLoading} error={reports.error} onRetry={() => void reports.refetch()} pageSize={15} empty={{ title: "No trading in this range" }} />
        </Panel>
      </div>
    </>
  );
}
