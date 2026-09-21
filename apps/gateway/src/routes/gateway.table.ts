// The public API surface as data: path, owning service, who may call it. No route sets a score, a winner or a ledger row.

import type { ActorKind } from "@betng/service-kit";
import type { GatewayRoute, RateLimitRule, RouteAccess, UpstreamName } from "../interfaces/index.js";

type Method = GatewayRoute["method"];

const PUBLIC: RouteAccess = { type: "public" };
const TOKEN: RouteAccess = { type: "token" };

const actor = (kinds: readonly ActorKind[], permission?: string): RouteAccess => ({
  type: "actor",
  kinds,
  ...(permission === undefined ? {} : { permission }),
});

const CUSTOMER = actor(["CUSTOMER"]);
const CUSTOMER_OR_ADMIN = actor(["CUSTOMER", "ADMIN"]);
const cashier = (permission: string): RouteAccess => actor(["CASHIER"], permission);
const admin = (permission?: string): RouteAccess => actor(["ADMIN"], permission);

function route(method: Method, path: string, upstream: UpstreamName, access: RouteAccess): GatewayRoute {
  return { method, path, upstream, access };
}

export function buildRouteTable(loginLimit: RateLimitRule): readonly GatewayRoute[] {
  const credential = (path: string): GatewayRoute => ({
    method: "POST",
    path,
    upstream: "identity",
    access: PUBLIC,
    rateLimit: loginLimit,
  });

  return [
    route("GET", "/leagues", "match", PUBLIC),
    route("GET", "/leagues/:id/standings", "match", PUBLIC),
    route("GET", "/leagues/:id/scorers", "match", PUBLIC),
    route("GET", "/teams", "match", PUBLIC),
    route("GET", "/fixtures", "match", PUBLIC),
    route("GET", "/matches", "match", PUBLIC),
    route("GET", "/matches/:id", "match", PUBLIC),
    route("GET", "/matches/:id/events", "match", PUBLIC),
    route("GET", "/matches/:id/stats", "match", PUBLIC),
    route("GET", "/results", "match", PUBLIC),
    route("GET", "/matches/:id/odds", "odds", PUBLIC),
    route("GET", "/odds", "odds", PUBLIC),

    credential("/auth/register"),
    credential("/auth/verify"),
    credential("/auth/verify/resend"),
    credential("/auth/login"),
    credential("/auth/password/forgot"),
    route("POST", "/auth/logout", "identity", TOKEN),
    route("GET", "/auth/me", "identity", TOKEN),

    route("POST", "/bets", "betting", CUSTOMER),
    route("GET", "/bets", "betting", CUSTOMER_OR_ADMIN),
    route("GET", "/bets/:id", "betting", CUSTOMER_OR_ADMIN),
    route("GET", "/wallets/:userId", "wallet", CUSTOMER_OR_ADMIN),
    route("GET", "/wallets/:userId/transactions", "wallet", CUSTOMER_OR_ADMIN),
    route("POST", "/wallets/deposit", "wallet", CUSTOMER),
    route("POST", "/wallets/withdraw", "wallet", CUSTOMER),
    route("GET", "/settlements", "settlement", CUSTOMER_OR_ADMIN),
    route("GET", "/settlements/:betId", "settlement", CUSTOMER_OR_ADMIN),

    credential("/shop/auth/login"),
    route("POST", "/shop/auth/logout", "identity", TOKEN),
    route("GET", "/shop/auth/session", "identity", TOKEN),
    route("GET", "/shop/cashiers", "identity", cashier("cashiers:read")),
    route("POST", "/shop/tickets", "betting", cashier("tickets:sell")),
    route("GET", "/shop/tickets", "betting", cashier("tickets:check")),
    route("GET", "/shop/tickets/:code", "betting", cashier("tickets:check")),
    route("POST", "/shop/tickets/:code/payout", "betting", cashier("tickets:payout")),
    route("POST", "/shop/tickets/:code/cancel", "betting", cashier("tickets:cancel")),
    route("GET", "/shop/transactions", "wallet", cashier("transactions:read")),
    route("GET", "/shop/reports/daily", "analytics", cashier("reports:read")),
    route("GET", "/shop/reports/daily/range", "analytics", cashier("reports:read")),

    credential("/admin/auth/login"),
    route("POST", "/admin/auth/logout", "identity", TOKEN),
    route("GET", "/admin/auth/session", "identity", TOKEN),

    route("GET", "/admin/users", "identity", admin("users:read")),
    route("POST", "/admin/users/:id/status", "identity", admin("users:write")),
    route("GET", "/admin/shops", "identity", admin("shops:read")),
    route("POST", "/admin/shops", "identity", admin("shops:write")),
    route("GET", "/admin/shops/:id", "identity", admin("shops:read")),
    route("PATCH", "/admin/shops/:id", "identity", admin("shops:write")),
    route("POST", "/admin/shops/:id/status", "identity", admin("shops:write")),
    route("GET", "/admin/shops/:id/cashiers", "identity", admin("shops:read")),
    route("POST", "/admin/shops/:id/cashiers", "identity", admin("cashiers:write")),
    route("POST", "/admin/shops/:id/cashiers/:cashierId/status", "identity", admin("cashiers:write")),
    route("POST", "/admin/shops/:id/cashiers/:cashierId/reset-credentials", "identity", admin("cashiers:write")),
    route("GET", "/admin/audit", "identity", admin("audit:read")),
    route("GET", "/admin/settings", "identity", admin("settings:read")),
    route("PATCH", "/admin/settings", "identity", admin("settings:write")),

    route("GET", "/admin/leagues", "match", admin("catalogue:read")),
    route("POST", "/admin/leagues", "match", admin("catalogue:write")),
    route("GET", "/admin/teams", "match", admin("catalogue:read")),
    route("POST", "/admin/teams", "match", admin("catalogue:write")),
    route("PATCH", "/admin/teams/:id", "match", admin("catalogue:write")),
    route("GET", "/admin/fixtures", "match", admin("fixtures:read")),
    route("POST", "/admin/fixtures", "match", admin("fixtures:operate")),
    route("GET", "/admin/matches/:id", "match", admin("fixtures:read")),
    route("POST", "/admin/matches/:id/actions", "match", admin("fixtures:operate")),

    route("GET", "/admin/odds", "odds", admin("odds:read")),
    route("GET", "/admin/odds/config", "odds", admin("odds:read")),
    route("PUT", "/admin/odds/config", "odds", admin("odds:write")),
    route("POST", "/admin/markets/:id/actions", "odds", admin("odds:write")),

    route("GET", "/admin/risk/overview", "risk", admin("risk:read")),
    route("GET", "/admin/risk/exposure", "risk", admin("risk:read")),
    route("GET", "/admin/risk/limits", "risk", admin("risk:read")),
    route("PUT", "/admin/risk/limits", "risk", admin("risk:write")),

    route("GET", "/admin/simulations", "simulation", admin("simulation:read")),
    route("POST", "/admin/simulations/:id/actions", "simulation", admin("simulation:operate")),
    route("GET", "/admin/simulation/config", "simulation", admin("simulation:read")),
    route("PUT", "/admin/simulation/config", "simulation", admin("simulation:operate")),

    route("GET", "/admin/settlements", "settlement", admin("settlement:read")),
    route("POST", "/admin/settlements/:id/retry", "settlement", admin("settlement:operate")),
    route("GET", "/admin/operator", "settlement", admin("settlement:read")),
    route("GET", "/admin/operator/periods", "settlement", admin("settlement:read")),
    route("POST", "/admin/operator/periods/close", "settlement", admin("settlement:operate")),
    route("GET", "/admin/commission", "settlement", admin("settlement:read")),
    route("GET", "/admin/commission/config", "settlement", admin("settlement:read")),
    route("PUT", "/admin/commission/config", "settlement", admin("settlement:operate")),

    route("GET", "/admin/wallet/overview", "wallet", admin("wallet:read")),

    route("GET", "/admin/overview", "analytics", admin()),
    route("GET", "/admin/reports/daily", "analytics", admin("reports:read")),
    route("GET", "/admin/analytics/overview", "analytics", admin("reports:read")),
    route("GET", "/admin/analytics/breakdown", "analytics", admin("reports:read")),
    route("GET", "/admin/analytics/sessions", "analytics", admin("reports:read")),
    route("GET", "/admin/analytics/matches/:id", "analytics", admin("reports:read")),
    route("GET", "/admin/analytics/accounts/:id", "analytics", admin("reports:read")),
    route("GET", "/admin/analytics/shops/:id", "analytics", admin("reports:read")),
    route("GET", "/admin/analytics/cashiers/:id", "analytics", admin("reports:read")),
  ];
}
