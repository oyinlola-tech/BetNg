import { createBrowserRouter, Navigate } from "react-router";
import {
  HomeScreen,
  LiveIndexScreen,
  LiveScreen,
  MatchdayScreen,
  ResultsScreen,
  Shell,
  StandingsScreen,
  UpcomingScreen,
} from "../screens";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Shell,
    children: [
      { index: true, Component: HomeScreen },
      { path: "live", Component: LiveIndexScreen },
      { path: "live/:matchId", Component: LiveScreen },
      { path: "matchday", Component: MatchdayScreen },
      { path: "results", Component: ResultsScreen },
      { path: "standings", Component: StandingsScreen },
      { path: "upcoming", Component: UpcomingScreen },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
