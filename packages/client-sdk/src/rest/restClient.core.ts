import { API_PREFIX } from "@betng/contracts/runtime";
import type {
  Bet,
  CompletedMatch,
  Fixture,
  HeadToHead,
  League,
  Match,
  MatchEvent,
  MatchLineups,
  MatchOdds,
  MatchStats,
  Notification,
  Page,
  PlaceBetRequest,
  PublicConfig,
  SearchResponse,
  Standings,
  Team,
  TopScorer,
  Transaction,
  Wallet,
} from "@betng/contracts";
import type { BetNgClientConfig } from "../config/index.js";
import {
  buildQuery,
  createRequester,
  type ListResponse,
  type RequestOptions,
} from "./request.js";
import { createAuthClient, type BetNgAuthClient } from "./authClient.js";
import { createShopClient, type BetNgShopClient } from "./shopClient.js";
import { createAdminClient, type BetNgAdminClient } from "./adminClient.js";
import { createAccountClient, type BetNgAccountClient } from "./accountClient.js";
import { createComplianceClient, type BetNgComplianceClient } from "./complianceClient.js";

export interface LedgerEntry {
  readonly wallet: Wallet;
  readonly transaction: Transaction;
}

export interface MatchWindowQuery {
  readonly leagueId?: string;
  readonly status?: string;
  readonly season?: number;
  readonly matchday?: number;
  readonly from?: string;
  readonly to?: string;
  readonly limit?: number;
}

export interface SearchRequest {
  readonly q: string;
  readonly kinds?: readonly string[];
  readonly limit?: number;
}

export interface TransactionPageQuery {
  readonly page?: number;
  readonly pageSize?: number;
  readonly types?: readonly string[];
  readonly statuses?: readonly string[];
  readonly from?: string;
  readonly to?: string;
  readonly search?: string;
  readonly sort?: string;
  readonly direction?: "asc" | "desc";
}

const text = (value: number | undefined): string | undefined =>
  value === undefined ? undefined : String(value);

function windowQuery(query: MatchWindowQuery): string {
  return buildQuery({
    ...query,
    season: text(query.season),
    matchday: text(query.matchday),
    limit: text(query.limit),
  });
}

export interface BetNgRestClient {
  listLeagues(): Promise<readonly League[]>;
  listTeams(leagueId?: string): Promise<readonly Team[]>;
  listFixtures(query?: MatchWindowQuery): Promise<readonly Fixture[]>;
  listMatches(query?: MatchWindowQuery): Promise<readonly Match[]>;
  listResults(query?: {
    readonly leagueId?: string;
    readonly limit?: number;
  }): Promise<readonly CompletedMatch[]>;
  listMatchOdds(matchIds: readonly string[]): Promise<readonly MatchOdds[]>;
  getMatch(matchId: string): Promise<Match>;
  /** The timeline so far, oldest first. */
  listMatchEvents(matchId: string): Promise<readonly MatchEvent[]>;
  getMatchStats(matchId: string): Promise<MatchStats>;
  getMatchOdds(matchId: string): Promise<MatchOdds>;
  getMatchLineups(matchId: string): Promise<MatchLineups>;
  getHeadToHead(matchId: string): Promise<HeadToHead>;
  search(query: SearchRequest): Promise<SearchResponse>;
  getPublicConfig(): Promise<PublicConfig>;
  getStandings(leagueId: string, season?: number): Promise<Standings>;
  listTopScorers(
    leagueId: string,
    season?: number,
  ): Promise<readonly TopScorer[]>;
  listNotifications(userId: string): Promise<readonly Notification[]>;
  markNotificationsRead(userId: string, ids?: readonly string[]): Promise<void>;
  placeBet(
    request: PlaceBetRequest,
    options?: Pick<RequestOptions, "idempotencyKey">,
  ): Promise<Bet>;
  listBets(query?: {
    readonly userId?: string;
    readonly status?: string;
  }): Promise<readonly Bet[]>;
  getBet(betId: string): Promise<Bet>;
  getWallet(userId: string): Promise<Wallet>;
  listTransactions(userId: string): Promise<readonly Transaction[]>;
  queryTransactions(
    userId: string,
    query: TransactionPageQuery,
  ): Promise<Page<Transaction>>;
  deposit(userId: string, amount: number): Promise<LedgerEntry>;
  withdraw(userId: string, amount: number): Promise<LedgerEntry>;

  readonly auth: BetNgAuthClient;
  readonly shop: BetNgShopClient;
  readonly admin: BetNgAdminClient;
  readonly account: BetNgAccountClient;
  readonly compliance: BetNgComplianceClient;
}

export function createRestClient(config: BetNgClientConfig): BetNgRestClient {
  const request = createRequester(config);

  return {
    auth: createAuthClient(request),
    shop: createShopClient(request),
    admin: createAdminClient(request),
    account: createAccountClient(request),
    compliance: createComplianceClient(request),

    listLeagues: async () =>
      (await request<ListResponse<League>>("GET", `${API_PREFIX}/leagues`))
        .items,

    listTeams: async (leagueId) =>
      (
        await request<ListResponse<Team>>(
          "GET",
          `${API_PREFIX}/teams${buildQuery({ leagueId })}`,
        )
      ).items,

    listFixtures: async (query = {}) =>
      (
        await request<ListResponse<Fixture>>(
          "GET",
          `${API_PREFIX}/fixtures${windowQuery(query)}`,
        )
      ).items,

    listResults: async (query = {}) =>
      (
        await request<ListResponse<CompletedMatch>>(
          "GET",
          `${API_PREFIX}/results${buildQuery({ leagueId: query.leagueId, limit: text(query.limit) })}`,
        )
      ).items,

    listMatchOdds: async (matchIds) =>
      matchIds.length === 0
        ? []
        : (
            await request<ListResponse<MatchOdds>>(
              "GET",
              `${API_PREFIX}/odds${buildQuery({ matchIds: matchIds.join(",") })}`,
            )
          ).items,

    listMatches: async (query = {}) =>
      (
        await request<ListResponse<Match>>(
          "GET",
          `${API_PREFIX}/matches${windowQuery(query)}`,
        )
      ).items,

    getMatch: async (matchId) =>
      request<Match>("GET", `${API_PREFIX}/matches/${matchId}`),

    listMatchEvents: async (matchId) =>
      (
        await request<ListResponse<MatchEvent>>(
          "GET",
          `${API_PREFIX}/matches/${matchId}/events`,
        )
      ).items,

    getMatchStats: async (matchId) =>
      request<MatchStats>("GET", `${API_PREFIX}/matches/${matchId}/stats`),

    getMatchOdds: async (matchId) =>
      request<MatchOdds>("GET", `${API_PREFIX}/matches/${matchId}/odds`),

    getMatchLineups: async (matchId) =>
      request<MatchLineups>("GET", `${API_PREFIX}/matches/${matchId}/lineups`),

    getHeadToHead: async (matchId) =>
      request<HeadToHead>(
        "GET",
        `${API_PREFIX}/matches/${matchId}/head-to-head`,
      ),

    search: async (query) =>
      request<SearchResponse>(
        "GET",
        `${API_PREFIX}/search${buildQuery({ q: query.q, kinds: query.kinds, limit: query.limit })}`,
      ),

    getPublicConfig: async () =>
      request<PublicConfig>("GET", `${API_PREFIX}/config`),

    getStandings: async (leagueId, season) =>
      request<Standings>(
        "GET",
        `${API_PREFIX}/leagues/${leagueId}/standings${buildQuery({
          season: season === undefined ? undefined : String(season),
        })}`,
      ),

    listTopScorers: async (leagueId, season) =>
      (
        await request<ListResponse<TopScorer>>(
          "GET",
          `${API_PREFIX}/leagues/${leagueId}/scorers${buildQuery({
            season: season === undefined ? undefined : String(season),
          })}`,
        )
      ).items,

    listNotifications: async (userId) =>
      (
        await request<ListResponse<Notification>>(
          "GET",
          `${API_PREFIX}/users/${userId}/notifications`,
        )
      ).items,

    markNotificationsRead: async (userId, ids) => {
      await request<unknown>(
        "POST",
        `${API_PREFIX}/users/${userId}/notifications/read`,
        ids === undefined ? {} : { ids },
      );
    },

    placeBet: async (betRequest, options) =>
      request<Bet>("POST", `${API_PREFIX}/bets`, betRequest, options),

    listBets: async (query = {}) =>
      (
        await request<ListResponse<Bet>>(
          "GET",
          `${API_PREFIX}/bets${buildQuery(query)}`,
        )
      ).items,

    getBet: async (betId) => request<Bet>("GET", `${API_PREFIX}/bets/${betId}`),

    getWallet: async (userId) =>
      request<Wallet>("GET", `${API_PREFIX}/wallets/${userId}`),

    listTransactions: async (userId) =>
      (
        await request<ListResponse<Transaction>>(
          "GET",
          `${API_PREFIX}/wallets/${userId}/transactions`,
        )
      ).items,

    queryTransactions: async (userId, query) =>
      request<Page<Transaction>>(
        "GET",
        `${API_PREFIX}/wallets/${userId}/transactions${buildQuery({ ...query, page: query.page ?? 1 })}`,
      ),

    deposit: async (userId, amount) =>
      request<LedgerEntry>("POST", `${API_PREFIX}/wallets/deposit`, {
        userId,
        amount,
      }),

    withdraw: async (userId, amount) =>
      request<LedgerEntry>("POST", `${API_PREFIX}/wallets/withdraw`, {
        userId,
        amount,
      }),
  };
}
