import { useNavigate } from "react-router";
import type { RiskOverview } from "@betng/contracts";
import { formatKickoffTime, formatMoney } from "@betng/ui-core";
import { DataTable, ErrorState, KpiCard, Panel, RankedBars, SkeletonRows, type Column } from "@betng/ui-web";
import { Meter, Status } from "../components/Bits";
import { PageHeader } from "../components/PageHeader";
import { useRisk } from "../hooks/queries";
import { formatMoneyShort, formatPercent } from "../lib/format";

type MatchRisk = RiskOverview["byMatch"][number];

export function RiskPage(): React.JSX.Element {
  const navigate = useNavigate();
  const risk = useRisk();
  const r = risk.data;

  if (r === undefined && risk.error !== null) return <ErrorState error={risk.error} onRetry={() => void risk.refetch()} />;

  const decisions = r === undefined ? 0 : r.decisions.accepted + r.decisions.limited + r.decisions.rejected;
  const columns: readonly Column<MatchRisk>[] = [
    { key: "match", header: "Match", sortValue: (m) => m.matchLabel, cell: (m) => <span className="whitespace-nowrap font-medium">{m.matchLabel}</span> },
    { key: "league", header: "Competition", sortValue: (m) => m.leagueName, cell: (m) => <span className="whitespace-nowrap text-text-secondary">{m.leagueName}</span>, hideBelow: "md" },
    { key: "kickoff", header: "Kick-off", numeric: true, align: "left", sortValue: (m) => m.kickoffAt, cell: (m) => formatKickoffTime(m.kickoffAt), hideBelow: "md" },
    { key: "stake", header: "Stake", numeric: true, sortValue: (m) => m.stake, cell: (m) => formatMoney(m.stake) },
    { key: "exposure", header: "Exposure", numeric: true, sortValue: (m) => m.exposure, cell: (m) => <span className="font-medium">{formatMoney(m.exposure)}</span> },
    { key: "state", header: "Risk state", sortValue: (m) => m.state, cell: (m) => <Status value={m.state} /> },
  ];

  return (
    <>
      <PageHeader title="Risk" description="Exposure on matches that are open or in play. The risk service can limit or reject a bet and suspend a market; it has no channel to the simulation." />
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Total stake" value={r === undefined ? undefined : formatMoneyShort(r.totalStake)} hint="open and in play" />
          <KpiCard label="Potential payout" value={r === undefined ? undefined : formatMoneyShort(r.potentialPayout)} hint="if every worst case lands" positiveIsGood={false} />
          <KpiCard label="Exposure" value={r === undefined ? undefined : formatMoneyShort(r.exposure)} hint={r === undefined ? undefined : `${formatPercent(r.exposure / (r.exposureLimit || 1), 0)} of limit`} emphasis />
          <div className="rounded-md border border-border bg-surface px-4 py-3">
            <p className="caps-label">Risk state</p>
            <div className="mt-2">{r === undefined ? <SkeletonRows rows={1} /> : <Status value={r.state} />}</div>
            <p className="mt-1.5 text-sm text-text-muted">Elevated above 55%, critical above 85% of the limit.</p>
          </div>
        </div>

        <Panel title="Exposure against limit">
          {r === undefined ? (
            <SkeletonRows rows={1} />
          ) : (
            <>
              <div className="mb-2 flex items-baseline justify-between text-sm">
                <span className="font-display text-lg font-semibold tabular text-text-primary">{formatMoney(r.exposure)}</span>
                <span className="tabular text-text-muted">limit {formatMoney(r.exposureLimit)}</span>
              </div>
              <Meter value={r.exposure} limit={r.exposureLimit} label="Platform exposure against limit" />
            </>
          )}
        </Panel>

        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Decisions today" description="Bets assessed by the risk service">
            {r === undefined ? (
              <SkeletonRows rows={3} />
            ) : (
              <dl className="space-y-3">
                {(
                  [
                    ["Accepted", r.decisions.accepted, "Taken at the requested stake"],
                    ["Limited", r.decisions.limited, "Taken at a reduced stake"],
                    ["Rejected", r.decisions.rejected, "Refused outright"],
                  ] as const
                ).map(([label, count, help]) => (
                  <div key={label} className="flex items-baseline justify-between gap-3">
                    <dt>
                      <span className="block text-base font-medium text-text-primary">{label}</span>
                      <span className="block text-sm text-text-muted">{help}</span>
                    </dt>
                    <dd className="text-right">
                      <span className="block font-display text-lg font-semibold tabular">{count.toLocaleString()}</span>
                      <span className="block text-sm tabular text-text-muted">{formatPercent(count / (decisions || 1))}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </Panel>
          <Panel title="Exposure by market" className="lg:col-span-2">
            {r === undefined ? <SkeletonRows rows={5} /> : <RankedBars title="Exposure by market type" formatValue={formatMoney} items={r.byMarket.map((m) => ({ key: m.marketType, label: m.marketLabel, detail: `stake ${formatMoneyShort(m.stake)}`, value: m.exposure }))} />}
          </Panel>
        </div>

        <Panel title="Exposure by match" flush>
          <DataTable caption="Exposure by match" columns={columns} rows={r?.byMatch} rowKey={(m) => m.matchId} loading={risk.isLoading} onRowClick={(m) => void navigate(`/matches/${m.matchId}`)} pageSize={12} initialSort={{ key: "exposure", direction: "desc" }} empty={{ title: "Nothing at risk", description: "No match is open for betting or in play." }} />
        </Panel>
      </div>
    </>
  );
}
