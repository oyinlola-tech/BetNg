import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { Button, Panel, SearchInput, Select } from "@betng/ui-web";
import { MarketsBoard } from "../components/MarketsBoard";
import { PageHeader } from "../components/PageHeader";
import { useMarketOdds } from "../hooks/queries";
import { formatCount } from "../lib/format";

const ANY = "all";

/* The platform answers the trading board in one piece; there is no paged market list in the contract, so these filters narrow what is drawn and live in the URL. */
function TradingPage({ mode }: { readonly mode: "markets" | "odds" }): React.JSX.Element {
  const odds = useMarketOdds();
  const [params, setParams] = useSearchParams();
  const league = params.get("league") ?? ANY;
  const status = params.get("status") ?? "OPEN";
  const q = params.get("q") ?? "";

  const set = (key: string, value: string, fallback: string): void => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);

        if (value === fallback || value === "") next.delete(key);
        else next.set(key, value);

        return next;
      },
      { replace: true },
    );
  };

  const leagues = useMemo(() => [...new Set((odds.data ?? []).map((m) => m.leagueName))], [odds.data]);
  const markets = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return odds.data?.filter((m) => (league === ANY || m.leagueName === league) && (status === ANY || m.status === status) && (needle === "" || `${m.matchLabel} ${m.marketLabel}`.toLowerCase().includes(needle)));
  }, [odds.data, league, status, q]);
  const filtered = params.has("league") || params.has("status") || params.has("q");

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
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <SearchInput label="Search matches and markets" placeholder="Search match or market" value={q} onChange={(value) => set("q", value, "")} className="w-full sm:w-72" />
          <Select label="League" size="sm" value={league} onChange={(value) => set("league", value, ANY)} options={[{ value: ANY, label: "All leagues" }, ...leagues.map((l) => ({ value: l, label: l }))]} />
          <Select
            label="Market status"
            size="sm"
            value={status}
            onChange={(value) => set("status", value, "OPEN")}
            options={[
              { value: ANY, label: "All statuses" },
              { value: "OPEN", label: "Open" },
              { value: "SUSPENDED", label: "Suspended" },
              { value: "CLOSED", label: "Closed" },
            ]}
          />
          {filtered && (
            <Button variant="ghost" size="sm" onClick={() => setParams({}, { replace: true })}>
              Clear
            </Button>
          )}
          <span role="status" className="ml-auto text-sm tabular text-text-muted">
            {markets === undefined ? "" : `${formatCount(markets.length)} markets shown`}
          </span>
        </div>
      </Panel>
      <MarketsBoard markets={markets} loading={odds.isPending} error={odds.error} onRetry={() => void odds.refetch()} mode={mode} />
    </>
  );
}

export const MarketsPage = (): React.JSX.Element => <TradingPage mode="markets" />;
export const OddsPage = (): React.JSX.Element => <TradingPage mode="odds" />;
