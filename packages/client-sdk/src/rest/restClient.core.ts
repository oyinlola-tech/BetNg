/**
 * The REST client every BetNG client app uses.
 *
 * Web, mobile and TV all call the same gateway endpoints. Sharing one
 * implementation is what keeps that true: there is no mobile-only backend
 * path, because there is no mobile-only client code that could ask for one.
 *
 * Built on `fetch`, which React Native and every browser provide, so the
 * same module runs unchanged in all three.
 */

import { API_PREFIX, REQUEST_ID_HEADER } from "@betng/contracts/runtime";
import type {
  Bet,
  Fixture,
  League,
  Match,
  MatchOdds,
  PlaceBetRequest,
  Team,
  Transaction,
  Wallet,
} from "@betng/contracts";
import { DEFAULT_TIMEOUT_MS, type BetNgClientConfig } from "../config/index.js";
import { BetNgApiError, isErrorResponse } from "./restError.js";

/** A list endpoint's response. */
interface ListResponse<T> {
  readonly items: readonly T[];
}

/** What a deposit or withdrawal answers with. */
export interface LedgerEntry {
  readonly wallet: Wallet;
  readonly transaction: Transaction;
}

/** The calls a BetNG client can make. */
export interface BetNgRestClient {
  listLeagues(): Promise<readonly League[]>;
  listTeams(leagueId?: string): Promise<readonly Team[]>;
  listFixtures(): Promise<readonly Fixture[]>;
  listMatches(query?: {
    readonly leagueId?: string;
    readonly status?: string;
  }): Promise<readonly Match[]>;
  getMatch(matchId: string): Promise<Match>;
  getMatchOdds(matchId: string): Promise<MatchOdds>;
  placeBet(request: PlaceBetRequest): Promise<Bet>;
  listBets(query?: {
    readonly userId?: string;
    readonly status?: string;
  }): Promise<readonly Bet[]>;
  getBet(betId: string): Promise<Bet>;
  getWallet(userId: string): Promise<Wallet>;
  listTransactions(userId: string): Promise<readonly Transaction[]>;
  deposit(userId: string, amount: number): Promise<LedgerEntry>;
  withdraw(userId: string, amount: number): Promise<LedgerEntry>;
}

function buildQuery(query: Readonly<Record<string, string | undefined>>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, value);
  }

  const search = params.toString();

  return search === "" ? "" : `?${search}`;
}

/**
 * Creates the REST client.
 *
 * @param config - Where the gateway is, and how long to wait.
 * @returns A client for every public endpoint.
 */
export function createRestClient(config: BetNgClientConfig): BetNgRestClient {
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    // A client-generated id lets a user report a failure by quoting it, and
    // the platform echoes it through every service the request touched.
    const requestId = crypto.randomUUID();

    try {
      const response = await fetch(new URL(path, config.gatewayUrl), {
        method,
        headers: {
          accept: "application/json",
          [REQUEST_ID_HEADER]: requestId,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      });

      const payload: unknown = await response.json();

      if (!response.ok) {
        if (isErrorResponse(payload)) {
          throw new BetNgApiError(response.status, payload.error);
        }

        throw new BetNgApiError(response.status, {
          code: "INTERNAL_ERROR",
          message: `The platform answered ${String(response.status)}.`,
          requestId,
        });
      }

      return payload as T;
    } catch (error) {
      if (error instanceof BetNgApiError) throw error;

      // A network failure and a timeout both look like "we got no answer" to
      // a user, but only one is worth retrying, so they are distinguished.
      throw new BetNgApiError(0, {
        code:
          error instanceof Error && error.name === "AbortError"
            ? "SERVICE_UNAVAILABLE"
            : "UPSTREAM_UNAVAILABLE",
        message:
          error instanceof Error && error.name === "AbortError"
            ? `The platform did not answer within ${String(timeoutMs)}ms.`
            : "The platform could not be reached.",
        requestId,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
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

    listFixtures: async () =>
      (await request<ListResponse<Fixture>>("GET", `${API_PREFIX}/fixtures`))
        .items,

    listMatches: async (query = {}) =>
      (
        await request<ListResponse<Match>>(
          "GET",
          `${API_PREFIX}/matches${buildQuery(query)}`,
        )
      ).items,

    getMatch: async (matchId) =>
      request<Match>("GET", `${API_PREFIX}/matches/${matchId}`),

    getMatchOdds: async (matchId) =>
      request<MatchOdds>("GET", `${API_PREFIX}/matches/${matchId}/odds`),

    placeBet: async (betRequest) =>
      request<Bet>("POST", `${API_PREFIX}/bets`, betRequest),

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
