import { API_PREFIX } from "@betng/contracts";
import { created, json } from "@betng/service-kit";
import type { HttpRouter } from "@betng/service-kit";
import type { WalletController } from "../controllers/index.js";

function describe(description: string): {
  readonly metadata: { readonly description: string };
} {
  return { metadata: { description } };
}

export function registerWalletRoutes(
  router: HttpRouter,
  controller: WalletController,
): void {
  router.get(
    `${API_PREFIX}/wallets/:userId`,
    json(controller.getWallet),
    describe(
      "A customer's play-money wallet. The customer themselves (or `me`), or an admin with wallet:read.",
    ),
  );
  router.get(
    `${API_PREFIX}/wallets/:userId/transactions`,
    json(controller.listTransactions),
    describe("A customer's ledger, newest first. Same access as the wallet."),
  );
  router.post(
    `${API_PREFIX}/wallets/deposit`,
    created(controller.deposit),
    describe(
      "Simulated top-up of play money into the calling customer's own wallet. No payment provider is involved.",
    ),
  );
  router.post(
    `${API_PREFIX}/wallets/withdraw`,
    created(controller.withdraw),
    describe(
      "Simulated withdrawal of play money from the calling customer's own wallet. No payment provider is involved.",
    ),
  );
  router.get(
    `${API_PREFIX}/shop/transactions`,
    json(controller.listShopTransactions),
    describe(
      "The calling cashier's shop float transactions for one UTC day. Requires transactions:read.",
    ),
  );
  router.get(
    `${API_PREFIX}/admin/wallet/overview`,
    json(controller.getOverview),
    describe(
      "Platform wallet totals and recent ledger entries. Admin with wallet:read.",
    ),
  );
}
