import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router";
import type { AdminPermission } from "@betng/contracts";
import { LoadingState } from "@betng/ui-web";
import { RequirePermission } from "../components/Guard";
import { AdminShell } from "../layouts/AdminShell";
import { DashboardPage } from "../pages/DashboardPage";

type Loader = () => Promise<{ readonly default: React.ComponentType }>;

function page(load: Loader, permission?: AdminPermission): React.ComponentType {
  const Loaded = lazy(load);

  return function Page() {
    const content = (
      <Suspense fallback={<LoadingState />}>
        <Loaded />
      </Suspense>
    );

    return permission === undefined ? content : <RequirePermission permission={permission}>{content}</RequirePermission>;
  };
}

const pick =
  <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K): Loader =>
  () =>
    load().then((m) => ({ default: m[name] }));

const catalogue = () => import("../pages/CataloguePages");
const trading = () => import("../pages/TradingPages");
const finance = () => import("../pages/FinancePages");

export const router = createBrowserRouter([
  {
    path: "/",
    Component: AdminShell,
    children: [
      { index: true, Component: DashboardPage },
      { path: "users", Component: page(pick(() => import("../pages/UsersPage"), "UsersPage"), "users:read") },
      { path: "shops", Component: page(pick(() => import("../pages/ShopsPage"), "ShopsPage"), "shops:read") },
      { path: "shops/:shopId", Component: page(pick(() => import("../pages/ShopDetailPage"), "ShopDetailPage"), "shops:read") },
      { path: "cashiers", Component: page(pick(() => import("../pages/CashiersPage"), "CashiersPage"), "shops:read") },
      { path: "leagues", Component: page(pick(() => import("../pages/LeaguesPage"), "LeaguesPage"), "catalogue:read") },
      { path: "leagues/:leagueId", Component: page(pick(() => import("../pages/LeagueDetailPage"), "LeagueDetailPage"), "catalogue:read") },
      { path: "teams", Component: page(pick(catalogue, "TeamsPage"), "catalogue:read") },
      { path: "teams/:teamId", Component: page(pick(catalogue, "TeamsPage"), "catalogue:read") },
      { path: "fixtures", Component: page(pick(catalogue, "FixturesPage"), "fixtures:read") },
      { path: "matches", Component: page(pick(catalogue, "MatchesPage"), "fixtures:read") },
      { path: "matches/:matchId", Component: page(pick(() => import("../pages/MatchControlPage"), "MatchControlPage"), "fixtures:read") },
      { path: "markets", Component: page(pick(trading, "MarketsPage"), "odds:read") },
      { path: "odds", Component: page(pick(trading, "OddsPage"), "odds:read") },
      { path: "risk", Component: page(pick(() => import("../pages/RiskPage"), "RiskPage"), "risk:read") },
      { path: "simulation", Component: page(pick(() => import("../pages/SimulationPage"), "SimulationPage"), "simulation:read") },
      { path: "live", Component: page(pick(() => import("../pages/LiveControlPage"), "LiveControlPage"), "fixtures:read") },
      { path: "settlement", Component: page(pick(finance, "SettlementPage"), "settlement:read") },
      { path: "wallet", Component: page(pick(finance, "WalletPage"), "wallet:read") },
      { path: "reports", Component: page(pick(finance, "ReportsPage"), "reports:read") },
      { path: "audit", Component: page(pick(() => import("../pages/AuditPage"), "AuditPage"), "audit:read") },
      { path: "health", Component: page(pick(() => import("../pages/HealthPage"), "HealthPage"), "health:read") },
      { path: "settings", Component: page(pick(() => import("../pages/SettingsPage"), "SettingsPage"), "settings:read") },
      { path: "*", Component: page(pick(() => import("../pages/NotFoundPage"), "NotFoundPage")) },
    ],
  },
]);
