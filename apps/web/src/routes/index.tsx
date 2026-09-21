import { lazy } from "react";
import { createBrowserRouter, type RouteObject } from "react-router";
import { RouteErrorBoundary } from "@betng/ui-web";
import { AppShell } from "../layouts/AppShell";
import { logger } from "../services/runtime";
import { accountRoutes, authRoutes } from "./account.routes";
import { legalRoutes } from "./legal.routes";
import { moneyRoutes } from "./money.routes";

const HomePage = lazy(() => import("../pages/HomePage").then((m) => ({ default: m.HomePage })));
const LivePage = lazy(() => import("../pages/LivePage").then((m) => ({ default: m.LivePage })));
const LobbyPage = lazy(() => import("../pages/LobbyPage").then((m) => ({ default: m.LobbyPage })));
const LeaguesPage = lazy(() => import("../pages/LeaguesPage").then((m) => ({ default: m.LeaguesPage })));
const LeaguePage = lazy(() => import("../pages/LeaguePage").then((m) => ({ default: m.LeaguePage })));
const ResultsPage = lazy(() => import("../pages/ResultsPage").then((m) => ({ default: m.ResultsPage })));
const StandingsPage = lazy(() => import("../pages/StandingsPage").then((m) => ({ default: m.StandingsPage })));
const MatchPage = lazy(() => import("../pages/MatchPage").then((m) => ({ default: m.MatchPage })));
const TeamPage = lazy(() => import("../pages/TeamPage").then((m) => ({ default: m.TeamPage })));
const SearchPage = lazy(() => import("../pages/SearchPage").then((m) => ({ default: m.SearchPage })));
const HelpPage = lazy(() => import("../pages/HelpPage").then((m) => ({ default: m.HelpPage })));
const UnauthorizedPage = lazy(() => import("../pages/UnauthorizedPage").then((m) => ({ default: m.UnauthorizedPage })));
const ForbiddenPage = lazy(() => import("../pages/ForbiddenPage").then((m) => ({ default: m.ForbiddenPage })));
const NotFoundPage = lazy(() => import("../pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));

function RouteError(): React.JSX.Element {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <RouteErrorBoundary
        onError={(error) => {
          logger.error("ui", "A route failed", { error: error instanceof Error ? error.message : String(error) });
        }}
      />
    </div>
  );
}

export const appRoutes: RouteObject[] = [
  {
    path: "/",
    Component: AppShell,
    errorElement: <RouteError />,
    children: [
      { index: true, Component: HomePage },
      { path: "live", Component: LivePage },
      { path: "virtuals", Component: LobbyPage },
      { path: "leagues", Component: LeaguesPage },
      { path: "leagues/:leagueId", Component: LeaguePage },
      { path: "results", Component: ResultsPage },
      { path: "results/:matchId", Component: MatchPage },
      { path: "matches/:matchId", Component: MatchPage },
      { path: "standings", Component: StandingsPage },
      { path: "teams/:teamId", Component: TeamPage },
      { path: "search", Component: SearchPage },
      { path: "help", Component: HelpPage },
      { path: "unauthorized", Component: UnauthorizedPage },
      { path: "forbidden", Component: ForbiddenPage },
      ...accountRoutes,
      ...moneyRoutes,
      ...legalRoutes,
      { path: "*", Component: NotFoundPage },
    ],
  },
  ...authRoutes.map((route) => ({ errorElement: <RouteError />, ...route })),
];

export function createAppRouter(): ReturnType<typeof createBrowserRouter> {
  return createBrowserRouter(appRoutes);
}
