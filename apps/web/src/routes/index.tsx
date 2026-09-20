import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router";
import { Spinner } from "@betng/ui-web";
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
      { path: "history", Component: HistoryPage },
      { path: "wallet", Component: WalletPage },
      { path: "notifications", Component: NotificationsPage },
      { path: "settings", Component: SettingsPage },
      { path: "*", Component: NotFoundPage },
    ],
  },
]);
