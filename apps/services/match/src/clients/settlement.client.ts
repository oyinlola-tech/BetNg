import { createRpcClient } from "@betng/service-kit";
import type { ServiceEndpoint } from "@betng/service-kit";
import type { RPCClient } from "@zudojs/rpc";
import { z } from "@zudojs/validation";
import type { ValidationSchema } from "@zudojs/validation";
import type { MatchSettlementResult, SettlementPeer } from "../interfaces/index.js";
import { callValidated } from "./rpc.client.js";

export const SETTLEMENT_PROCEDURE = Object.freeze({
  SETTLE_MATCH: "settlement.settleMatch",
  VOID_MATCH: "settlement.voidMatch",
});

const SETTLE_TIMEOUT_MS = 15_000;

const resultSchema: ValidationSchema<MatchSettlementResult> = z.object({
  matchId: z.uuid(),
  status: z.string().min(1).max(32),
  betsTotal: z.int().min(0),
  betsSettled: z.int().min(0),
  duplicate: z.boolean(),
});

export function createSettlementClient(endpoint: ServiceEndpoint): SettlementPeer & { readonly raw: RPCClient } {
  const raw = createRpcClient(endpoint, { timeoutMs: Math.max(endpoint.timeoutMs, SETTLE_TIMEOUT_MS) });

  return {
    raw,
    settleMatch: async (matchId, requestId) =>
      callValidated(raw, SETTLEMENT_PROCEDURE.SETTLE_MATCH, { matchId }, requestId, resultSchema),
    voidMatch: async (matchId, reason, requestId) =>
      callValidated(raw, SETTLEMENT_PROCEDURE.VOID_MATCH, { matchId, reason }, requestId, resultSchema),
  };
}
