import { createRpcClient } from "@betng/service-kit";
import type { ServiceEndpoint } from "@betng/service-kit";
import { createRPCMetadata } from "@zudojs/rpc";
import type { RPCClient } from "@zudojs/rpc";
import type {
  ApplySettlementRequest,
  ApplySettlementResult,
  BettingPeer,
} from "../interfaces/index.js";

export const BETTING_PROCEDURE = Object.freeze({
  APPLY_SETTLEMENT: "betting.applySettlement",
});

export interface BettingClient extends BettingPeer {
  readonly raw: RPCClient;
}

export function createBettingClient(endpoint: ServiceEndpoint): BettingClient {
  const client = createRpcClient(endpoint);

  return {
    raw: client,
    applySettlement: async (request, requestId) =>
      client.call<ApplySettlementRequest, ApplySettlementResult>(
        BETTING_PROCEDURE.APPLY_SETTLEMENT,
        request,
        { metadata: createRPCMetadata({ requestId }) },
      ),
  };
}
