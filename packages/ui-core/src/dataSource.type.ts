/**
 * The boundary between a screen and the platform.
 *
 * Every client — web, mobile, TV — talks to one of these and nothing else.
 * Two implementations exist: `@betng/mock-data` runs a deterministic
 * virtual season in-process, and `createPlatformDataSource` adapts the
 * real gateway and event stream through `@betng/client-sdk`. A screen
 * cannot tell which it has, which is the point: the interface is the
 * contract the frontend is built against, and the backend grows into it.
 *
 * Reads return view models, already joined. Writes are the handful of
 * simulated actions a user can take. Live is a subscription that resolves
 * to an unsubscribe.
 */

import type { LeagueId, MatchId, TeamId } from "@betng/contracts";
import type {
  BetView,
  ConnectionState,
  LeagueView,
  MatchEventView,
  MatchMarketsView,
  MatchPhase,
  MatchSummary,
  MatchView,
  NotificationPreferences,
  NotificationView,
  PlaceBetInput,
  StandingsView,
  TeamDetailView,
  TeamView,
  TopScorer,
  TransactionView,
  WalletView,
} from "./types/index.js";

export interface MatchFilter {
  readonly leagueId?: LeagueId;
  readonly phases?: readonly MatchPhase[];
  readonly season?: number;
  readonly matchday?: number;
  /** A local calendar date, `YYYY-MM-DD`, for results browsing. */
  readonly date?: string;
  readonly teamId?: TeamId;
  readonly limit?: number;
}

export interface LiveMatchHandlers {
  readonly onEvent: (event: MatchEventView) => void;
  readonly onConnection: (state: ConnectionState) => void;
}

export interface LiveSubscription {
  readonly unsubscribe: () => void;
}

export interface BetNgDataSource {
  /* ---- Competition ------------------------------------------------- */
  listLeagues(): Promise<readonly LeagueView[]>;
  getLeague(leagueId: LeagueId): Promise<LeagueView>;
  listTeams(leagueId?: LeagueId): Promise<readonly TeamView[]>;
  getTeam(teamId: TeamId): Promise<TeamDetailView>;
  getStandings(leagueId: LeagueId, season?: number): Promise<StandingsView>;
  getTopScorers(leagueId: LeagueId, season?: number): Promise<readonly TopScorer[]>;

  /* ---- Matches ----------------------------------------------------- */
  listMatches(filter?: MatchFilter): Promise<readonly MatchSummary[]>;
  getMatch(matchId: MatchId): Promise<MatchView>;
  getMatchMarkets(matchId: MatchId): Promise<MatchMarketsView>;
  /** Matchday numbers with at least one completed match, newest first. */
  listCompletedMatchdays(leagueId: LeagueId, season?: number): Promise<readonly number[]>;

  /* ---- Live -------------------------------------------------------- */
  subscribeMatch(matchId: MatchId, handlers: LiveMatchHandlers): LiveSubscription;
  /** The shared connection state, for a global banner. */
  subscribeConnection(listener: (state: ConnectionState) => void): () => void;
  getConnectionState(): ConnectionState;

  /* ---- Account (simulated) ----------------------------------------- */
  getWallet(): Promise<WalletView>;
  listTransactions(): Promise<readonly TransactionView[]>;
  deposit(amount: number): Promise<WalletView>;
  withdraw(amount: number): Promise<WalletView>;
  placeBet(input: PlaceBetInput): Promise<BetView>;
  listBets(): Promise<readonly BetView[]>;
  getBet(betId: string): Promise<BetView>;
  listNotifications(): Promise<readonly NotificationView[]>;
  markNotificationsRead(ids?: readonly string[]): Promise<void>;
  getNotificationPreferences(): Promise<NotificationPreferences>;
  setNotificationPreferences(preferences: NotificationPreferences): Promise<void>;
  /** Matches the user opened, most recent first. */
  listViewedMatches(): Promise<readonly MatchSummary[]>;
  recordView(matchId: MatchId): void;

  /** Notifies listeners that account state (wallet, bets, notifications) changed. */
  subscribeAccount(listener: () => void): () => void;
}

/** Thrown by a data source for a failure a screen should show. */
export class DataSourceError extends Error {
  public constructor(
    public readonly code:
      | "NOT_FOUND"
      | "NETWORK"
      | "SERVER"
      | "BETTING_CLOSED"
      | "INSUFFICIENT_FUNDS"
      | "VALIDATION",
    message: string,
  ) {
    super(message);
    this.name = "DataSourceError";
  }
}
