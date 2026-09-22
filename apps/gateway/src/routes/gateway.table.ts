// The public API surface as data: path, owning service, who may call it. No route sets a score, a winner or a ledger row.

import type { ActorKind } from "@betng/service-kit";
import type { GatewayRateLimits } from "../configs/gateway.config.js";
import type { GatewayRoute, RouteAccess, RouteLimit, UpstreamName } from "../interfaces/index.js";

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

function route(
  method: Method,
  path: string,
  upstream: UpstreamName,
  access: RouteAccess,
  extra: Pick<GatewayRoute, "limits" | "webhook" | "sessionHash" | "userAgent"> = {},
): GatewayRoute {
  return { method, path, upstream, access, ...extra };
}

const WEBHOOK_SIGNATURES: Readonly<Record<string, readonly string[]>> = {
  paystack: ["x-paystack-signature"],
  flutterwave: ["verif-hash"],
  bachs: ["x-bachs-signature"],
};

export function buildRouteTable(limits: GatewayRateLimits): readonly GatewayRoute[] {
  const limit = (name: keyof GatewayRateLimits, scope: RouteLimit["scope"], failClosed: boolean): RouteLimit => ({
    name,
    scope,
    rule: limits[name],
    failClosed,
  });

  const credentialLimit = { limits: [limit("credential", "ip", false)] };
  const credential = (path: string): GatewayRoute => route("POST", path, "identity", PUBLIC, credentialLimit);
  const signIn = (path: string): GatewayRoute => route("POST", path, "identity", PUBLIC, { ...credentialLimit, userAgent: true });
  const money = (name: "bets" | "deposits" | "withdrawals") => ({ limits: [limit(name, "actor", true)] });
  const kycUpload = { limits: [limit("kycUploads", "actor", true)] };
  const verification = { limits: [limit("verification", "actor", true)] };
  const statements = { limits: [limit("statements", "actor", false)] };
  const session = { sessionHash: true };
  const webhook = (provider: string): GatewayRoute =>
    route("POST", `/payments/webhook/${provider}`, "wallet", PUBLIC, {
      limits: [limit("webhooks", "ip", false)],
      webhook: { signatureHeaders: WEBHOOK_SIGNATURES[provider] ?? [] },
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
    route("GET", "/matches/:id/lineups", "match", PUBLIC),
    route("GET", "/matches/:id/head-to-head", "match", PUBLIC),
    route("GET", "/search", "match", PUBLIC),
    route("GET", "/config", "match", PUBLIC),
    route("GET", "/results", "match", PUBLIC),
    route("GET", "/matches/:id/odds", "odds", PUBLIC),
    route("GET", "/odds", "odds", PUBLIC),

    credential("/auth/register"),
    signIn("/auth/verify"),
    credential("/auth/verify/resend"),
    signIn("/auth/login"),
    credential("/auth/password/forgot"),
    signIn("/auth/login/2fa"),
    credential("/auth/password/reset"),
    route("POST", "/auth/logout", "identity", TOKEN),
    route("GET", "/auth/me", "identity", TOKEN),
    route("POST", "/auth/session/refresh", "identity", TOKEN),

    route("PUT", "/account/password", "identity", CUSTOMER, { ...verification, ...session }),
    route("GET", "/account/2fa", "identity", CUSTOMER, session),
    route("POST", "/account/2fa/enroll", "identity", CUSTOMER, session),
    route("POST", "/account/2fa/confirm", "identity", CUSTOMER, { ...verification, ...session }),
    route("POST", "/account/2fa/disable", "identity", CUSTOMER, { ...verification, ...session }),
    route("POST", "/account/2fa/backup-codes", "identity", CUSTOMER, { ...verification, ...session }),
    route("GET", "/account/sessions", "identity", CUSTOMER, session),
    route("DELETE", "/account/sessions", "identity", CUSTOMER, session),
    route("DELETE", "/account/sessions/:id", "identity", CUSTOMER, session),
    route("GET", "/account/deletion", "identity", CUSTOMER, session),
    route("POST", "/account/deletion", "identity", CUSTOMER, { ...verification, ...session }),
    route("DELETE", "/account/deletion", "identity", CUSTOMER, session),
    route("POST", "/account/statements", "wallet", CUSTOMER, statements),
    route("GET", "/account/statements/:id", "wallet", CUSTOMER),

    route("GET", "/notifications/preferences", "identity", CUSTOMER),
    route("PUT", "/notifications/preferences", "identity", CUSTOMER),
    route("GET", "/notifications/push/devices", "identity", CUSTOMER, session),
    route("POST", "/notifications/push/register", "identity", CUSTOMER, session),
    route("DELETE", "/notifications/push/devices/:id", "identity", CUSTOMER, session),

    route("GET", "/kyc/status", "identity", CUSTOMER),
    route("GET", "/kyc/documents", "identity", CUSTOMER),
    route("POST", "/kyc/documents/uploads", "identity", CUSTOMER, kycUpload),
    route("POST", "/kyc/documents", "identity", CUSTOMER, kycUpload),
    route("POST", "/kyc/verify/bvn", "identity", CUSTOMER, verification),
    route("POST", "/kyc/verify/nin", "identity", CUSTOMER, verification),

    route("GET", "/limits/summary", "identity", CUSTOMER),
    route("PUT", "/limits", "identity", CUSTOMER),
    route("DELETE", "/limits/:kind", "identity", CUSTOMER),
    route("POST", "/limits/self-exclude", "identity", CUSTOMER, verification),
    route("DELETE", "/limits/self-exclude", "identity", CUSTOMER),
    route("GET", "/limits/history", "identity", CUSTOMER),

    route("POST", "/payments/deposit/initiate", "wallet", CUSTOMER, money("deposits")),
    route("POST", "/payments/deposit/verify", "wallet", CUSTOMER),
    route("GET", "/payments/history", "wallet", CUSTOMER),
    route("POST", "/payments/withdraw/quote", "wallet", CUSTOMER),
    route("POST", "/payments/withdraw/request", "wallet", CUSTOMER, money("withdrawals")),
    route("GET", "/payments/withdraw/status/:reference", "wallet", CUSTOMER),
    route("GET", "/payments/banks", "wallet", CUSTOMER),
    route("POST", "/payments/bank-accounts/verify", "wallet", CUSTOMER, verification),
    route("POST", "/payments/bank-accounts", "wallet", CUSTOMER),
    route("GET", "/payments/bank-accounts", "wallet", CUSTOMER),
    route("POST", "/payments/bank-accounts/:id/default", "wallet", CUSTOMER),
    route("DELETE", "/payments/bank-accounts/:id", "wallet", CUSTOMER),
    webhook("paystack"),
    webhook("flutterwave"),
    webhook("bachs"),

    route("POST", "/bets", "betting", CUSTOMER, money("bets")),
    route("GET", "/bets", "betting", CUSTOMER_OR_ADMIN),
    route("GET", "/bets/:id", "betting", CUSTOMER_OR_ADMIN),
    route("GET", "/wallets/:userId", "wallet", CUSTOMER_OR_ADMIN),
    route("GET", "/wallets/:userId/transactions", "wallet", CUSTOMER_OR_ADMIN),
    route("POST", "/wallets/deposit", "wallet", CUSTOMER, money("deposits")),
    route("POST", "/wallets/withdraw", "wallet", CUSTOMER, money("withdrawals")),
    route("GET", "/users/:id/notifications", "identity", CUSTOMER),
    route("POST", "/users/:id/notifications/read", "identity", CUSTOMER),
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
    route("GET", "/shop/shifts/current", "wallet", cashier("shifts:operate")),
    route("GET", "/shop/shifts", "wallet", cashier("shifts:operate")),
    route("POST", "/shop/shifts", "wallet", cashier("shifts:operate")),
    route("POST", "/shop/shifts/current/cash", "wallet", cashier("cash:move")),
    route("POST", "/shop/shifts/:id/close", "wallet", cashier("shifts:operate")),

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
    route("GET", "/admin/kyc/pending", "identity", admin("kyc:read")),
    route("POST", "/admin/kyc/review/:userId", "identity", admin("kyc:write")),
    route("GET", "/admin/kyc/documents/:id/preview", "identity", admin("kyc:read")),
    route("GET", "/admin/responsible-gaming", "identity", admin("users:read")),

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
    route("GET", "/admin/payments/overview", "wallet", admin("payments:read")),
    route("GET", "/admin/payments", "wallet", admin("payments:read")),
    route("POST", "/admin/payments/withdrawals/:reference/review", "wallet", admin("payments:write")),

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
