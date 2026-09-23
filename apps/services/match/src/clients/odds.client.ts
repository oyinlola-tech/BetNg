import { createRpcClient } from "@betng/service-kit";
import type { ServiceEndpoint } from "@betng/service-kit";
import type { RPCClient } from "@zudojs/rpc";
import { z } from "@zudojs/validation";
import type { ValidationSchema } from "@zudojs/validation";
import type {
  OddsPeer,
  PublishMarketsResult,
  RecalculateOddsResult,
} from "../interfaces/index.js";
import { callValidated } from "./rpc.client.js";

export const ODDS_PROCEDURE = Object.freeze({
  PUBLISH_MARKETS: "odds.publishMarkets",
  RECALCULATE_ODDS: "odds.recalculateOdds",
  SET_MATCH_MARKETS_STATUS: "odds.setMatchMarketsStatus",
});

const publishMarketsResultSchema: ValidationSchema<PublishMarketsResult> =
  z.object({
    matchId: z.uuid(),
    markets: z.int().min(0),
    oddsVersion: z.int().min(1),
  });

const marketsStatusResultSchema: ValidationSchema<{
  readonly updated: number;
}> = z.object({
  updated: z.int().min(0),
});

const recalculateResultSchema: ValidationSchema<RecalculateOddsResult> =
  z.object({
    matchId: z.uuid(),
    markets: z.int().min(0),
    oddsVersion: z.int().min(0),
    recalculated: z.boolean(),
  });

export function createOddsClient(
  endpoint: ServiceEndpoint,
): OddsPeer & { readonly raw: RPCClient } {
  const raw = createRpcClient(endpoint);

  return {
    raw,
    publishMarkets: async (input, requestId) =>
      callValidated(
        raw,
        ODDS_PROCEDURE.PUBLISH_MARKETS,
        input,
        requestId,
        publishMarketsResultSchema,
      ),
    recalculate: async (input, requestId) =>
      callValidated(
        raw,
        ODDS_PROCEDURE.RECALCULATE_ODDS,
        input,
        requestId,
        recalculateResultSchema,
      ),
    setMatchMarketsStatus: async (matchId, status, requestId) =>
      callValidated(
        raw,
        ODDS_PROCEDURE.SET_MATCH_MARKETS_STATUS,
        { matchId, status },
        requestId,
        marketsStatusResultSchema,
      ),
  };
}
