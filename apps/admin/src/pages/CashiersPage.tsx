import { useState } from "react";
import { useSearchParams } from "react-router";
import { Plus } from "lucide-react";
import { Panel } from "@betng/ui-web";
import { CashierList, CreateCashierDrawer } from "../components/CashierList";
import { GuardedButton } from "../components/Guard";
import { PageHeader } from "../components/PageHeader";
import { useShopDirectory } from "../hooks/queries";

export function CashiersPage(): React.JSX.Element {
  const [params] = useSearchParams();
  const shops = useShopDirectory();
  const [creating, setCreating] = useState(false);
  const shop = shops.data?.find((s) => s.id === params.get("shopId"));

  return (
    <>
      <PageHeader
        title="Cashiers"
        description="Every terminal account across all shops. Filter to one shop to add a cashier to it."
        actions={
          <GuardedButton permission="cashiers:write" leadingIcon={<Plus className="size-4" aria-hidden />} blockedReason={shop === undefined ? "Filter to one shop first" : undefined} onClick={() => setCreating(true)}>
            New cashier
          </GuardedButton>
        }
      />
      <Panel flush>
        <CashierList />
      </Panel>
      {shop !== undefined && <CreateCashierDrawer shopId={shop.id} shopCode={shop.code} open={creating} onClose={() => setCreating(false)} />}
    </>
  );
}
