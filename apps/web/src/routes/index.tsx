import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router";
import { Spinner } from "@betng/ui-web";
import { RequireAuth, type RequireAuthProps } from "../features/auth/RequireAuth";
import { AppShell } from "../layouts/AppShell";
import { HomePage } from "../pages/HomePage";

const page = (
  load: () => Promise<{ readonly default: React.ComponentType }>,
): React.ComponentType => {
  const Loaded = lazy(load);

  return function Page() {
    return (
      <Suspense
        fallback={
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        }
      >
        <Loaded />
      </Suspense>
    );
  };
};

const gated = (Page: React.ComponentType, gate: Omit<RequireAuthProps, "children">): React.ComponentType =>
  function Gated() {
    return (
      <RequireAuth {...gate}>
        <Page />
      </RequireAuth>
    );
  };

const LobbyPage = page(() =>
  import("../pages/LobbyPage").then((m) => ({ default: m.LobbyPage })),
);
const LivePage = page(() =>
  import("../pages/LivePage").then((m) => ({ default: m.LivePage })),
);
const MatchPage = page(() =>
  import("../pages/MatchPage").then((m) => ({ default: m.MatchPage })),
);
const ResultsPage = page(() =>
  import("../pages/ResultsPage").then((m) => ({ default: m.ResultsPage })),
);
const LeaguesPage = page(() =>
  import("../pages/LeaguesPage").then((m) => ({ default: m.LeaguesPage })),
);
const LeaguePage = page(() =>
  import("../pages/LeaguePage").then((m) => ({ default: m.LeaguePage })),
);
const StandingsPage = page(() =>
  import("../pages/StandingsPage").then((m) => ({ default: m.StandingsPage })),
);
const TeamPage = page(() =>
  import("../pages/TeamPage").then((m) => ({ default: m.TeamPage })),
);
const HistoryPage = page(() =>
  import("../pages/HistoryPage").then((m) => ({ default: m.HistoryPage })),
);
const WalletPage = page(() =>
  import("../pages/WalletPage").then((m) => ({ default: m.WalletPage })),
);
const NotificationsPage = page(() =>
  import("../pages/NotificationsPage").then((m) => ({
    default: m.NotificationsPage,
  })),
);
const SettingsPage = page(() =>
  import("../pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const AccountPage = page(() =>
  import("../pages/AccountPage").then((m) => ({ default: m.AccountPage })),
);
const LoginPage = page(() =>
  import("../pages/AuthPage").then((m) => ({ default: m.LoginPage })),
);
const RegisterPage = page(() =>
  import("../pages/AuthPage").then((m) => ({ default: m.RegisterPage })),
);
const ForgotPasswordPage = page(() =>
  import("../pages/AuthPage").then((m) => ({ default: m.ForgotPasswordPage })),
);
const NotFoundPage = page(() =>
  import("../pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })),
);

export const router = createBrowserRouter([
  {
    path: "/",
    Component: AppShell,
    children: [
      { index: true, Component: HomePage },
      { path: "virtuals", Component: LobbyPage },
      { path: "live", Component: LivePage },
      { path: "matches/:matchId", Component: MatchPage },
      { path: "results", Component: ResultsPage },
      { path: "results/:matchId", Component: MatchPage },
      { path: "leagues", Component: LeaguesPage },
      { path: "leagues/:leagueId", Component: LeaguePage },
      { path: "standings", Component: StandingsPage },
      { path: "teams/:teamId", Component: TeamPage },
      {
        path: "history",
        Component: gated(HistoryPage, {
          title: "Log in to see your bets",
          description: "Open bets, settled bets and transactions belong to your account.",
          reason: "Log in to see your bets",
        }),
      },
      {
        path: "wallet",
        Component: gated(WalletPage, {
          title: "Log in to open your wallet",
          description: "Your simulated balance, deposits and withdrawals belong to your account.",
          reason: "Log in to open your wallet",
        }),
      },
      {
        path: "notifications",
        Component: gated(NotificationsPage, {
          title: "Log in to see notifications",
          description: "Match and settlement alerts are sent to your account.",
          reason: "Log in to see your notifications",
        }),
      },
      {
        path: "account",
        Component: gated(AccountPage, {
          title: "Log in to manage your account",
          description: "Your profile and security settings are only visible to you.",
          reason: "Log in to manage your account",
        }),
      },
      { path: "login", Component: LoginPage },
      { path: "register", Component: RegisterPage },
      { path: "forgot-password", Component: ForgotPasswordPage },
      { path: "settings", Component: SettingsPage },
      { path: "*", Component: NotFoundPage },
    ],
  },
]);
