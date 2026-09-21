import type { NavigatorScreenParams } from "@react-navigation/native";

export type TabParamList = {
  Home: undefined;
  Live: undefined;
  Virtuals: undefined;
  Bets: undefined;
  Account: undefined;
};

export type AuthView = "login" | "register" | "verify" | "forgot" | "expired";

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  Match: { matchId: string; tab?: "OVERVIEW" | "EVENTS" | "STATS" | "MARKETS" };
  League: { leagueId: string };
  Standings: { leagueId?: string };
  Results: { leagueId?: string };
  Team: { teamId: string };
  Wallet: undefined;
  Transactions: undefined;
  Notifications: undefined;
  Settings: undefined;
  History: undefined;
  Auth: { view: AuthView; email?: string };
  Bet: { betId: string };
  Payment: { reference: string };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
