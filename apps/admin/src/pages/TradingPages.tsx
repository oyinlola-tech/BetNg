import { useMemo, useState } from "react";
import { Panel, SearchInput, Select } from "@betng/ui-web";
import { FilterBar } from "../components/Bits";
import { MarketsBoard } from "../components/MarketsBoard";
import { PageHeader } from "../components/PageHeader";
import { useMarketOdds } from "../hooks/queries";

type StatusFilter = "ALL" | "OPEN" | "SUSPENDED";

function TradingPage({ mode }: { readonly mode: "markets" | "odds" }): React.JSX.Element {
  const odds = useMarketOdds();
  const [league, setLeague] = useState("ALL");
  const [status, setStatus] = useState<StatusFilter>("OPEN");
  const [q, setQ] = useState("");
  const leagues = useMemo(() => [...new Set((odds.data ?? []).map((m) => m.leagueName))], [odds.data]);
  const markets = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return odds.data?.filter((m) => (league === "ALL" || m.leagueName === league) && (status === "ALL" || m.status === status) && (needle === "" || `${m.matchLabel} ${m.marketLabel}`.toLowerCase().includes(needle)));
  }, [odds.data, league, status, q]);

  return (
    <>
      <PageHeader
        title={mode === "markets" ? "Markets" : "Odds"}
        description={
          mode === "markets"
            ? "Every market on matches that are open for betting or in play. Suspending stops new bets; it never changes a price or a result."
            : "Current price against the opening price and the model's probability, with stake and liability per selection. Prices come from the odds service."
        }
      />
      <Panel flush className="mb-4">
        <FilterBar>
          <SearchInput label="Search matches and markets" placeholder="Search match or market" value={q} onChange={setQ} className="w-full sm:w-72" />
          <Select label="League" size="sm" value={league} onChange={setLeague} options={[{ value: "ALL", label: "All leagues" }, ...leagues.map((l) => ({ value: l, label: l }))]} />
          <Select
            label="Market status"
            size="sm"
            value={status}
            onChange={setStatus}
            options={[
              { value: "ALL", label: "All statuses" },
              { value: "OPEN", label: "Open" },
              { value: "SUSPENDED", label: "Suspended" },
            ]}
          />
          <span className="ml-auto text-sm tabular text-text-muted">{markets === undefined ? "" : `${String(markets.length)} markets`}</span>
        </FilterBar>
      </Panel>
      <MarketsBoard markets={markets} loading={odds.isLoading} error={odds.error} onRetry={() => void odds.refetch()} mode={mode} />
    </>
  );
}

export const MarketsPage = (): React.JSX.Element => <TradingPage mode="markets" />;
export const OddsPage = (): React.JSX.Element => <TradingPage mode="odds" />;
