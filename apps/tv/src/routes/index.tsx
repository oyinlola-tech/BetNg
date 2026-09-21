import { createBrowserRouter, Navigate } from "react-router";
import {
  BoardScreen,
  BroadcastScreen,
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
      { path: "board", Component: BoardScreen },
      { path: "live", Component: LiveIndexScreen },
      { path: "live/:matchId", Component: LiveScreen },
      { path: "match/:matchId", Component: LiveScreen },
      { path: "broadcast", Component: BroadcastScreen },
      { path: "matchday", Component: MatchdayScreen },
      { path: "results", Component: ResultsScreen },
      { path: "standings", Component: StandingsScreen },
      { path: "upcoming", Component: UpcomingScreen },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
