import { lazy, Suspense } from "react";
import { Navigate, useSearchParams, type RouteObject } from "react-router";
import { PageSkeleton } from "@betng/ui-web";
import type { AuthIntentName } from "../features/auth/auth.store";
import { RequireAuth } from "../features/auth/RequireAuth";

type Loader = () => Promise<{ readonly default: React.ComponentType }>;

function page(load: Loader, intent?: AuthIntentName): React.ComponentType {
  const Loaded = lazy(load);

  return function Page() {
    const content = (
      <Suspense fallback={<PageSkeleton cards={3} />}>
        <Loaded />
      </Suspense>
    );

    return intent === undefined ? content : <RequireAuth intent={intent}>{content}</RequireAuth>;
  };
}

function LegacyHistoryRedirect(): React.JSX.Element {
  const [params] = useSearchParams();

  return <Navigate to={params.get("tab")?.toLowerCase() === "transactions" ? "/transactions" : "/tickets"} replace />;
}

const TicketsPage = page(() => import("../pages/TicketsPage").then((m) => ({ default: m.TicketsPage })), "tickets");
const TicketPage = page(() => import("../pages/TicketPage").then((m) => ({ default: m.TicketPage })), "tickets");
const BetSlipPage = page(() => import("../pages/BetSlipPage").then((m) => ({ default: m.BetSlipPage })));
const WalletPage = page(() => import("../pages/WalletPage").then((m) => ({ default: m.WalletPage })), "wallet");
const TransactionsPage = page(() => import("../pages/TransactionsPage").then((m) => ({ default: m.TransactionsPage })), "transactions");
const NotificationsPage = page(() => import("../pages/NotificationsPage").then((m) => ({ default: m.NotificationsPage })), "notifications");
const SettingsPage = page(() => import("../pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const AccountLayout = page(() => import("../features/account/AccountLayout").then((m) => ({ default: m.AccountLayout })), "account");
const AccountProfilePage = page(() => import("../pages/AccountProfilePage").then((m) => ({ default: m.AccountProfilePage })));
const AccountPreferencesPage = page(() => import("../pages/AccountPreferencesPage").then((m) => ({ default: m.AccountPreferencesPage })));
const AccountSecurityPage = page(() => import("../pages/AccountSecurityPage").then((m) => ({ default: m.AccountSecurityPage })));
const AccountSessionsPage = page(() => import("../pages/AccountSessionsPage").then((m) => ({ default: m.AccountSessionsPage })));
const AccountNotificationsPage = page(() => import("../pages/AccountNotificationsPage").then((m) => ({ default: m.AccountNotificationsPage })));
const AccountActivityPage = page(() => import("../pages/AccountActivityPage").then((m) => ({ default: m.AccountActivityPage })));
const LoginPage = page(() => import("../pages/AuthPage").then((m) => ({ default: m.LoginPage })));
const RegisterPage = page(() => import("../pages/AuthPage").then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = page(() => import("../pages/AuthPage").then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = page(() => import("../pages/AuthPage").then((m) => ({ default: m.ResetPasswordPage })));
const AccountDeletionPage = page(() => import("../pages/AccountDeletionPage").then((m) => ({ default: m.AccountDeletionPage })));

/** Mounted under the app shell. Every account route is gated by `RequireAuth`; `/betslip` and `/settings` are open. */
export const accountRoutes: RouteObject[] = [
  { path: "tickets", Component: TicketsPage },
  { path: "tickets/:betId", Component: TicketPage },
  { path: "betslip", Component: BetSlipPage },
  { path: "wallet", Component: WalletPage },
  { path: "transactions", Component: TransactionsPage },
  { path: "notifications", Component: NotificationsPage },
  {
    path: "account",
    Component: AccountLayout,
    children: [
      { index: true, element: <Navigate to="/account/profile" replace /> },
      { path: "profile", Component: AccountProfilePage },
      { path: "preferences", Component: AccountPreferencesPage },
      { path: "security", Component: AccountSecurityPage },
      { path: "sessions", Component: AccountSessionsPage },
      { path: "notifications", Component: AccountNotificationsPage },
      { path: "activity", Component: AccountActivityPage },
      { path: "delete", Component: AccountDeletionPage },
    ],
  },
  { path: "settings", Component: SettingsPage },
  { path: "history", Component: LegacyHistoryRedirect },
];

export const authRoutes: RouteObject[] = [
  { path: "login", Component: LoginPage },
  { path: "register", Component: RegisterPage },
  { path: "forgot-password", Component: ForgotPasswordPage },
  { path: "reset-password", Component: ResetPasswordPage },
];
