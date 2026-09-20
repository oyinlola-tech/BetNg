import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Panel, SearchInput, Select } from "@betng/ui-web";
import { FilterBar } from "../components/Bits";
import { CashierTable, CreateCashierDrawer, type CashierRow } from "../components/CashierTable";
import { GuardedButton } from "../components/Guard";
import { PageHeader } from "../components/PageHeader";
import { useShops } from "../hooks/queries";
import { keys } from "../lib/queryKeys";
import { adminSource } from "../services/sources";

export function CashiersPage(): React.JSX.Element {
  const shops = useShops();
  const [shopId, setShopId] = useState("ALL");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const scope = useMemo(() => (shops.data ?? []).filter((s) => shopId === "ALL" || s.id === shopId), [shops.data, shopId]);
  const lists = useQueries({ queries: scope.map((s) => ({ queryKey: keys.cashiers(s.id), queryFn: () => adminSource.listCashiers(s.id) })) });

  const loading = shops.isLoading || lists.some((l) => l.isLoading);
  const error = shops.error ?? lists.find((l) => l.error !== null)?.error;
  const rows = useMemo(() => {
    if (loading) return undefined;

    const needle = q.trim().toLowerCase();

    return lists
      .flatMap((list, index): CashierRow[] => (list.data ?? []).map((c) => ({ ...c, shopCode: scope[index]?.code ?? "" })))
      .filter((c) => needle === "" || `${c.displayName} ${c.username} ${c.shopCode ?? ""}`.toLowerCase().includes(needle));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, q, scope, lists.map((l) => l.dataUpdatedAt).join()]);
  const selectedShop = scope.length === 1 ? scope[0] : undefined;

  return (
    <>
      <PageHeader
        title="Cashiers"
        description="Every terminal account across all shops. Pick a shop to add a cashier to it."
        actions={
          <GuardedButton permission="cashiers:write" icon={<Plus className="size-4" />} blockedReason={selectedShop === undefined ? "Choose a shop first" : undefined} onClick={() => setCreating(true)}>
            New cashier
          </GuardedButton>
        }
      />
      <Panel flush>
        <FilterBar>
          <SearchInput label="Search cashiers" placeholder="Search name, username, shop" value={q} onChange={setQ} className="w-full sm:w-72" />
          <Select label="Shop" size="sm" value={shopId} onChange={setShopId} options={[{ value: "ALL", label: "All shops" }, ...(shops.data ?? []).map((s) => ({ value: s.id as string, label: `${s.code} · ${s.name.replace("BetNG ", "")}` }))]} />
          <span className="ml-auto text-sm tabular text-text-muted">{rows === undefined ? "" : `${String(rows.length)} cashiers`}</span>
        </FilterBar>
        <CashierTable rows={rows} loading={loading} error={rows === undefined ? error : undefined} onRetry={() => void shops.refetch()} showShop />
      </Panel>
      {selectedShop !== undefined && <CreateCashierDrawer shopId={selectedShop.id} shopCode={selectedShop.code} open={creating} onClose={() => setCreating(false)} />}
    </>
  );
}
