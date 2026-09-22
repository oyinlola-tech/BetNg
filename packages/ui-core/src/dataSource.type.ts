import type { LeagueId, MatchId, TeamId, TwoFactorChallenge } from "@betng/contracts";
import type {
  BetPlacementView,
  BetView,
  ConnectionState,
  HeadToHeadView,
  LeagueView,
  MatchEventView,
  MatchLineupsView,
  MatchMarketsView,
  MatchPhase,
  MatchSummary,
  MatchView,
  NotificationPreferences,
  NotificationView,
  PageView,
  PlaceBetInput,
  PlatformConfigView,
  SearchQuery,
  SearchResults,
  StandingsView,
  TeamDetailView,
  TeamView,
  TopScorer,
  TransactionQuery,
  TransactionView,
  WalletView,
} from "./types/index.js";

export interface MatchFilter {
  readonly leagueId?: LeagueId;
  readonly phases?: readonly MatchPhase[];
  readonly season?: number;
  readonly matchday?: number;
  readonly date?: string;
  readonly teamId?: TeamId;
  readonly limit?: number;
}

/** A lifecycle frame on a match's stream that is not a timeline event. The authoritative state is re-read when one arrives. */
export type MatchSignal =
  | "BETTING_OPENED"
  | "BETTING_CLOSED"
  | "ODDS_UPDATED"
  | "MARKET_UPDATED"
  | "SIMULATION_STARTED"
  | "SETTLEMENT_STARTED"
  | "SETTLEMENT_COMPLETED"
  | "MATCH_UPDATED";

/** A "re-read this bet" signal from the customer's private channels. It carries no status or amount; `betId` is only a hint of which bet to re-read. */
export interface BetSignal {
  readonly kind: "BET_ACCEPTED" | "BET_SETTLED" | "BET_UPDATED";
  readonly betId?: string;
}

export interface LiveMatchHandlers {
  readonly onEvent: (event: MatchEventView) => void;
  readonly onSignal?: (signal: MatchSignal) => void;
  readonly onConnection: (state: ConnectionState) => void;
}

export interface LiveSubscription {
  readonly unsubscribe: () => void;
}

export interface BetNgDataSource {
  listLeagues(): Promise<readonly LeagueView[]>;
  getLeague(leagueId: LeagueId): Promise<LeagueView>;
  listTeams(leagueId?: LeagueId): Promise<readonly TeamView[]>;
  getTeam(teamId: TeamId): Promise<TeamDetailView>;
  getStandings(leagueId: LeagueId, season?: number): Promise<StandingsView>;
  getTopScorers(
    leagueId: LeagueId,
    season?: number,
  ): Promise<readonly TopScorer[]>;

  listMatches(filter?: MatchFilter): Promise<readonly MatchSummary[]>;
  getMatch(matchId: MatchId): Promise<MatchView>;
  getMatchMarkets(matchId: MatchId): Promise<MatchMarketsView>;
  getMatchLineups(matchId: MatchId): Promise<MatchLineupsView>;
  getHeadToHead(matchId: MatchId): Promise<HeadToHeadView>;
  search(query: SearchQuery): Promise<SearchResults>;
  getPlatformConfig(): Promise<PlatformConfigView>;
  listCompletedMatchdays(
    leagueId: LeagueId,
    season?: number,
  ): Promise<readonly number[]>;

  subscribeMatch(
    matchId: MatchId,
    handlers: LiveMatchHandlers,
  ): LiveSubscription;
  subscribeConnection(listener: (state: ConnectionState) => void): () => void;
  getConnectionState(): ConnectionState;

  getWallet(): Promise<WalletView>;
  listTransactions(): Promise<readonly TransactionView[]>;
  queryTransactions(query: TransactionQuery): Promise<PageView<TransactionView>>;
  deposit(amount: number): Promise<WalletView>;
  withdraw(amount: number): Promise<WalletView>;
  placeBet(input: PlaceBetInput): Promise<BetPlacementView>;
  listBets(): Promise<readonly BetView[]>;
  getBet(betId: string): Promise<BetView>;
  listNotifications(): Promise<readonly NotificationView[]>;
  markNotificationsRead(ids?: readonly string[]): Promise<void>;
  getNotificationPreferences(): Promise<NotificationPreferences>;
  setNotificationPreferences(
    preferences: NotificationPreferences,
  ): Promise<void>;
  listViewedMatches(): Promise<readonly MatchSummary[]>;
  recordView(matchId: MatchId): void;

  subscribeAccount(listener: () => void): () => void;
  /** Absent, or a no-op, until the realtime endpoint authenticates the account channels. */
  subscribeBetSignals?(listener: (signal: BetSignal) => void): () => void;
}

export type DataSourceErrorCode =
  | "NOT_FOUND"
  | "NETWORK"
  | "OFFLINE"
  | "TIMEOUT"
  | "SERVER"
  | "UNAVAILABLE"
  | "NOT_IMPLEMENTED"
  | "BETTING_CLOSED"
  | "MARKET_SUSPENDED"
  | "ODDS_CHANGED"
  | "STAKE_LIMITED"
  | "BET_REJECTED"
  | "INSUFFICIENT_FUNDS"
  | "VALIDATION"
  | "INVALID_CREDENTIALS"
  | "UNAUTHENTICATED"
  | "SESSION_EXPIRED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "TWO_FACTOR_REQUIRED"
  | "LIMIT_EXCEEDED"
  | "SELF_EXCLUDED"
  | "KYC_REQUIRED"
  | "PAYMENT_FAILED";

export interface DataSourceErrorDetail {
  readonly status?: number;
  readonly requestId?: string;
  readonly fields?: Readonly<Record<string, string>>;
  readonly retryAfterSeconds?: number;
  /** Set on TWO_FACTOR_REQUIRED: the platform's challenge to answer. */
  readonly challenge?: TwoFactorChallenge;
}

export class DataSourceError extends Error {
  public constructor(
    public readonly code: DataSourceErrorCode,
    message: string,
    public readonly detail: DataSourceErrorDetail = {},
  ) {
    super(message);
    this.name = "DataSourceError";
  }
}
