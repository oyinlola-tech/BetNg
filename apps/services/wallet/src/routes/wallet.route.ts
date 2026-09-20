/**
 * Wallet service routes.
 *
 * A deposit and a withdrawal both answer 201: each appends a new,
 * immutable entry to the ledger rather than editing an existing one.
 */

import { API_PREFIX } from "@betng/contracts";
import { created, json } from "@betng/service-kit";
import type { HttpRouter } from "@betng/service-kit";
import type { WalletController } from "../controllers/index.js";

export function registerWalletRoutes(
  router: HttpRouter,
  controller: WalletController,
): void {
  router.get(`${API_PREFIX}/wallets/:userId`, json(controller.getWallet));
  router.get(
    `${API_PREFIX}/wallets/:userId/transactions`,
    json(controller.listTransactions),
  );
  router.post(`${API_PREFIX}/wallets/deposit`, created(controller.deposit));
  router.post(`${API_PREFIX}/wallets/withdraw`, created(controller.withdraw));
}
