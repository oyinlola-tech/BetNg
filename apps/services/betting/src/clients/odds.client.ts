/**
 * The betting service's RPC client for the odds service.
 *
 * Betting asks odds what a selection is worth on the bet-placement path.
 * That is a lookup with a deadline on a latency-sensitive path, so RPC
 * rather than REST: a typed procedure, a typed error, and a call that fails
 * fast rather than hanging a bet slip.
 */

import { createRpcClient } from "@betng/service-kit";
import type { ServiceEndpoint } from "@betng/service-kit";
import { createRPCMetadata, RPCClient } from "@zudojs/rpc";

export const ODDS_PROCEDURE = Object.freeze({
  CALCULATE_ODDS: "odds.calculateOdds",
  GET_MATCH_ODDS: "odds.getMatchOdds",
});

export interface Selection {
  readonly id: string;
  readonly marketId: string;
  readonly code: string;
  readonly label: string;
  readonly odds: number;
  readonly probability: number;
}

export interface MatchOdds {
  readonly matchId: string;
  readonly markets: readonly {
    readonly id: string;
    readonly matchId: string;
    readonly type: string;
    readonly status: string;
    readonly selections: readonly Selection[];
    readonly updatedAt: string;
  }[];
  readonly generatedAt: string;
}

export interface OddsClient {
  readonly getMatchOdds: (
    matchId: string,
    requestId: string,
  ) => Promise<MatchOdds>;
  readonly raw: RPCClient;
}

export function createOddsClient(endpoint: ServiceEndpoint): OddsClient {
  const client = createRpcClient(endpoint);

  return {
    raw: client,
    getMatchOdds: async (matchId, requestId) =>
      client.call<{ readonly matchId: string }, MatchOdds>(
        ODDS_PROCEDURE.GET_MATCH_ODDS,
        { matchId },
        { metadata: createRPCMetadata({ requestId }) },
      ),
  };
}
