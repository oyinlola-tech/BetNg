/**
 * The gateway's route table.
 *
 * This is the platform's public API surface: every route BetNG exposes to
 * the outside world, at `/api/v1`, with the service that answers it named
 * beside it. Reading this file tells you what the platform offers and who
 * owns each part of it.
 *
 * The paths match the upstream services' own paths exactly, so a route can
 * move behind or out from behind the gateway without a client noticing.
 */

import { API_PREFIX } from "@betng/contracts";
import type { HttpRouter } from "@betng/service-kit";
import { proxyRead, proxyWrite } from "../controllers/index.js";
import type { UpstreamClients } from "../interfaces/index.js";

export function registerGatewayRoutes(
  router: HttpRouter,
  clients: UpstreamClients,
): void {
  router.get(`${API_PREFIX}/leagues`, proxyRead(clients, "match"));
  router.get(`${API_PREFIX}/teams`, proxyRead(clients, "match"));
  router.get(`${API_PREFIX}/fixtures`, proxyRead(clients, "match"));
  router.get(`${API_PREFIX}/matches`, proxyRead(clients, "match"));
  router.get(`${API_PREFIX}/matches/:id`, proxyRead(clients, "match"));

  router.get(`${API_PREFIX}/matches/:id/odds`, proxyRead(clients, "odds"));

  router.post(`${API_PREFIX}/bets`, proxyWrite(clients, "betting"));
  router.get(`${API_PREFIX}/bets`, proxyRead(clients, "betting"));
  router.get(`${API_PREFIX}/bets/:id`, proxyRead(clients, "betting"));

  router.get(`${API_PREFIX}/wallets/:userId`, proxyRead(clients, "wallet"));
  router.get(
    `${API_PREFIX}/wallets/:userId/transactions`,
    proxyRead(clients, "wallet"),
  );
  router.post(`${API_PREFIX}/wallets/deposit`, proxyWrite(clients, "wallet"));
  router.post(`${API_PREFIX}/wallets/withdraw`, proxyWrite(clients, "wallet"));

  router.get(`${API_PREFIX}/settlements`, proxyRead(clients, "settlement"));
  router.get(
    `${API_PREFIX}/settlements/:betId`,
    proxyRead(clients, "settlement"),
  );
}
