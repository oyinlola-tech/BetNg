import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router";
import { LoadingState } from "@betng/ui-web";
import { TerminalShell } from "../layouts/TerminalShell";
import { DashboardPage } from "../pages/DashboardPage";
import { TerminalPage, type TerminalMode } from "../pages/TerminalPage";
import { BetSlipPage } from "../pages/BetSlipPage";
import { VirtualLeaguePage } from "../pages/VirtualLeaguePage";

const page = (load: () => Promise<{ readonly default: React.ComponentType }>): React.ComponentType => {
  const Loaded = lazy(load);

  return function Page() {
    return (
      <Suspense fallback={<LoadingState />}>
        <Loaded />
      </Suspense>
    );
  };
};

const terminal = (mode: TerminalMode): React.ComponentType =>
  function Terminal() {
    return <TerminalPage mode={mode} />;
  };

const TicketPage = page(() => import("../pages/TicketPage").then((m) => ({ default: m.TicketPage })));
const OpenTicketsPage = page(() => import("../pages/OpenTicketsPage").then((m) => ({ default: m.OpenTicketsPage })));
const CheckTicketPage = page(() => import("../pages/CheckTicketPage").then((m) => ({ default: m.CheckTicketPage })));
const ResultsPage = page(() => import("../pages/ResultsPage").then((m) => ({ default: m.ResultsPage })));
const PayoutPage = page(() => import("../pages/PayoutPage").then((m) => ({ default: m.PayoutPage })));
const TransactionsPage = page(() => import("../pages/TransactionsPage").then((m) => ({ default: m.TransactionsPage })));
const DailyReportPage = page(() => import("../pages/DailyReportPage").then((m) => ({ default: m.DailyReportPage })));
const SalesReportPage = page(() => import("../pages/TrendReportPage").then((m) => ({ default: () => <m.TrendReportPage measure="sales" /> })));
const PayoutsReportPage = page(() => import("../pages/TrendReportPage").then((m) => ({ default: () => <m.TrendReportPage measure="payouts" /> })));
const ProfilePage = page(() => import("../pages/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const SecurityPage = page(() => import("../pages/SecurityPage").then((m) => ({ default: m.SecurityPage })));
const NotFoundPage = page(() => import("../pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));

export const router = createBrowserRouter([
  {
    path: "/",
    Component: TerminalShell,
    children: [
      { index: true, Component: DashboardPage },
      { path: "betting/football", Component: terminal("football") },
      { path: "betting/virtual", Component: VirtualLeaguePage },
      { path: "betting/live", Component: terminal("live") },
      { path: "betslip", Component: BetSlipPage },
      { path: "tickets/new", Component: VirtualLeaguePage },
      { path: "tickets/open", Component: OpenTicketsPage },
      { path: "tickets/check", Component: CheckTicketPage },
      { path: "tickets/results", Component: ResultsPage },
      { path: "tickets/:code", Component: TicketPage },
      { path: "cashier/payout", Component: PayoutPage },
      { path: "cashier/transactions", Component: TransactionsPage },
      { path: "reports/daily", Component: DailyReportPage },
      { path: "reports/sales", Component: SalesReportPage },
      { path: "reports/payouts", Component: PayoutsReportPage },
      { path: "account/profile", Component: ProfilePage },
      { path: "account/security", Component: SecurityPage },
      { path: "*", Component: NotFoundPage },
    ],
  },
]);
