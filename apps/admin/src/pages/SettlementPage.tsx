import { useState } from "react";
import { RotateCcw } from "lucide-react";
import type { AdminSettlement } from "@betng/contracts";
import { formatMoney, formatMoneyCompact } from "@betng/ui-core";
import { Drawer, Panel, SectionHeading, type Column } from "@betng/ui-web";
import { AdminListTable } from "../components/AdminListTable";
import { CopyButton, DetailItem, Mono, SignedMoney, Stamp, Status, Unavailable } from "../components/Bits";
import { GuardedButton } from "../components/Guard";
import { MetricCard, metricFrom } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { useReasonAction } from "../components/ReasonAction";
import { useAdminAction, useOperatorLedger } from "../hooks/queries";
import { useAdminList } from "../hooks/useAdminList";
import { formatCount, formatStamp } from "../lib/format";
import { adminSource } from "../services/runtime";

const owner = (s: AdminSettlement): string => s.owner.replace(/^(user|shop):/, "");

export function SettlementPage(): React.JSX.Element {
  const list = useAdminList("settlements", { defaults: { sort: "timestamp", direction: "desc" }, filterKeys: ["status", "channel"], refetchInterval: 15_000 });
  const ledger = useOperatorLedger();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const selected = list.query.data?.items.find((s) => s.id === selectedId);
  const { ask, dialog } = useReasonAction();
  const retry = useAdminAction({ run: (input: { readonly id: string; readonly reason: string }) => adminSource.retrySettlement(input.id, input.reason), success: () => "Settlement retried" });

  const retryButton = (s: AdminSettlement): React.ReactNode =>
    s.status === "FAILED" ? (
      <GuardedButton
        permission="settlement:operate"
        size="sm"
        variant="secondary"
        leadingIcon={<RotateCcw className="size-3.5" aria-hidden />}
        onClick={() => ask({ title: "Retry this settlement?", description: `${s.matchLabel}. The settlement service recalculates the bet from the recorded result and writes the ledger entry once.`, confirmLabel: "Retry settlement", run: (reason) => retry.mutateAsync({ id: s.id, reason }) })}
      >
        Retry
      </GuardedButton>
    ) : null;

  const columns: readonly Column<AdminSettlement>[] = [
    {
      key: "betId",
      header: "Bet / ticket",
      sortable: true,
      hideable: false,
      cell: (s) => (
        <span className="block leading-tight">
          <Mono className="block text-text-primary">{s.betId}</Mono>
          <Mono className="block text-text-muted">{s.ticketCode ?? "no ticket"}</Mono>
        </span>
      ),
    },
    {
      key: "owner",
      header: "Customer / shop",
      sortable: true,
      cell: (s) => (
        <span className="whitespace-nowrap">
          <span className="mr-1.5 rounded-xs bg-surface-sunken px-1 py-0.5 text-[10px] font-semibold uppercase tracking-caps text-text-muted">{s.channel === "SHOP" ? "Shop" : "Online"}</span>
          {owner(s)}
        </span>
      ),
      hideBelow: "xl",
    },
    { key: "matchLabel", header: "Match", sortable: true, cell: (s) => <span className="block min-w-36">{s.matchLabel}</span> },
    { key: "result", header: "Result", align: "center", cell: (s) => <span className="font-display font-semibold tabular">{s.result}</span> },
    {
      key: "status",
      header: "Status",
      sortable: true,
      cell: (s) => (
        <span>
          <Status value={s.status} />
          {s.error !== undefined && (
            <span title={s.error} className="mt-0.5 block max-w-44 truncate text-sm text-text-secondary">
              {s.error}
            </span>
          )}
        </span>
      ),
    },
    { key: "stake", header: "Stake", numeric: true, sortable: true, cell: (s) => formatMoney(s.stake), hideBelow: "lg" },
    { key: "payout", header: "Payout", numeric: true, sortable: true, cell: (s) => <span className="type-financial">{formatMoney(s.payout)}</span> },
    { key: "timestamp", header: "Settled at", sortable: true, cell: (s) => <Stamp iso={s.timestamp} />, hideBelow: "xl" },
    { key: "retries", header: "Retries", numeric: true, cell: () => <Unavailable what="The retry count" />, defaultHidden: true },
  ];

  return (
    <>
      <PageHeader title="Settlement" description="Bets settled from recorded results. A failed settlement can be retried; the outcome is recalculated from the result, never entered by hand." />
      <div className="space-y-6">
        <section aria-labelledby="settlement-period">
          <SectionHeading id="settlement-period" className="mb-3">
            Current operator period
          </SectionHeading>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
            <MetricCard label="Settled bets" state={metricFrom(ledger, (d) => formatCount(d.current.settledBets))} />
            <MetricCard label="Void bets" state={metricFrom(ledger, (d) => formatCount(d.current.voidBets))} />
            <MetricCard label="Total stake" state={metricFrom(ledger, (d) => formatMoneyCompact(d.current.grossStakes))} />
            <MetricCard label="Total payout" state={metricFrom(ledger, (d) => formatMoneyCompact(d.current.grossPayouts))} />
            <MetricCard label="Refunded stakes" state={metricFrom(ledger, (d) => formatMoneyCompact(d.current.refundedStakes))} />
            <MetricCard label="Operator result" state={metricFrom(ledger, (d) => <SignedMoney value={d.current.operatorResult} whole />)} />
          </div>
        </section>

        <Panel flush>
          <AdminListTable
            list={list}
            caption="Settlements"
            noun="settlements"
            columns={columns}
            rowKey={(s) => s.id}
            search={{ label: "Search settlements by bet, ticket, owner or match", placeholder: "Search bet, ticket, owner, match" }}
            filters={[
              {
                key: "status",
                label: "Settlement status",
                anyLabel: "All settlement states",
                options: [
                  { value: "PENDING", label: "Pending" },
                  { value: "COMPLETED", label: "Completed" },
                  { value: "FAILED", label: "Failed" },
                  { value: "VOIDED", label: "Voided" },
                ],
              },
              {
                key: "channel",
                label: "Channel",
                anyLabel: "All channels",
                options: [
                  { value: "ONLINE", label: "Online" },
                  { value: "SHOP", label: "Shop" },
                ],
              },
            ]}
            onRowClick={(s) => setSelectedId(s.id)}
            selectedKey={selectedId}
            rowActions={retryButton}
            renderCard={(s) => (
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{s.matchLabel}</span>
                    <Mono>{s.betId}</Mono>
                  </span>
                  <Status value={s.status} />
                </div>
                <div className="flex items-baseline justify-between text-sm text-text-secondary">
                  <span>
                    {s.result} · stake {formatMoney(s.stake)}
                  </span>
                  <span className="type-financial text-text-primary">{formatMoney(s.payout)}</span>
                </div>
              </div>
            )}
          />
        </Panel>
      </div>

      <Drawer open={selected !== undefined} onClose={() => setSelectedId(undefined)} title="Settlement" description={selected?.matchLabel ?? ""} footer={selected === undefined ? undefined : retryButton(selected)}>
        {selected !== undefined && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
            <DetailItem label="Settlement ID" className="col-span-2">
              <span className="flex items-center gap-1">
                <Mono className="whitespace-normal break-all text-text-primary">{selected.id}</Mono>
                <CopyButton value={selected.id} label="Copy settlement ID" />
              </span>
            </DetailItem>
            <DetailItem label="Bet">
              <Mono>{selected.betId}</Mono>
            </DetailItem>
            <DetailItem label="Ticket">{selected.ticketCode === undefined ? <span className="text-text-muted">No ticket</span> : <Mono>{selected.ticketCode}</Mono>}</DetailItem>
            <DetailItem label={selected.channel === "SHOP" ? "Shop" : "Customer"}>{owner(selected)}</DetailItem>
            <DetailItem label="Channel">{selected.channel === "SHOP" ? "Shop" : "Online"}</DetailItem>
            <DetailItem label="Result">
              <span className="font-display font-semibold tabular">{selected.result}</span>
            </DetailItem>
            <DetailItem label="Settlement status">
              <Status value={selected.status} />
            </DetailItem>
            <DetailItem label="Stake">
              <span className="type-financial">{formatMoney(selected.stake)}</span>
            </DetailItem>
            <DetailItem label="Payout">
              <span className="type-financial">{formatMoney(selected.payout)}</span>
            </DetailItem>
            <DetailItem label="Settled at">{formatStamp(selected.timestamp)}</DetailItem>
            <DetailItem label="Retry count">
              <Unavailable what="The retry count" />
            </DetailItem>
            <DetailItem label="Winning / losing / void selections" className="col-span-2">
              <Unavailable what="The selection breakdown" />
            </DetailItem>
            <DetailItem label="Operator result for this bet" className="col-span-2">
              <Unavailable what="A per-settlement operator result" />
            </DetailItem>
            {selected.error !== undefined && (
              <DetailItem label="Error" className="col-span-2">
                <span className="text-sm text-text-secondary">{selected.error}</span>
              </DetailItem>
            )}
          </dl>
        )}
      </Drawer>
      {dialog}
    </>
  );
}
