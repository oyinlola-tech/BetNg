import type { AdminShopSummary } from "@betng/contracts";
import { toAdminShopSummary } from "../../dtos/index.js";
import type { Shop } from "../../generated/prisma/client.js";
import type { HandlerDependencies } from "../../interfaces/index.js";

export async function summariseShops(
  deps: Pick<HandlerDependencies, "store" | "readModel">,
  shops: readonly Shop[],
): Promise<readonly AdminShopSummary[]> {
  const ids = shops.map((shop) => shop.id);

  const [figures, activity] = await Promise.all([
    deps.readModel.shopFigures(ids),
    deps.store.cashiers.activityByShop(ids),
  ]);

  const activityByShop = new Map(activity.map((entry) => [entry.shopId, entry]));

  return shops.map((shop) => toAdminShopSummary(shop, figures.get(shop.id), activityByShop.get(shop.id)));
}

export async function summariseShop(
  deps: Pick<HandlerDependencies, "store" | "readModel">,
  shop: Shop,
): Promise<AdminShopSummary> {
  const [summary] = await summariseShops(deps, [shop]);

  if (summary === undefined) {
    throw new Error("A shop summary was not produced for a shop that was passed in.");
  }

  return summary;
}
