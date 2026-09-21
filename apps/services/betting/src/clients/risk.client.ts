import { riskDecisionSchema } from "@betng/contracts";
import type { RiskDecision, RiskEvaluateRequest } from "@betng/contracts";
import { createRPCMetadata } from "@zudojs/rpc";
import type { RPCClient } from "@zudojs/rpc";
import { validate } from "@zudojs/validation";
import { classifyPeerFailure, PeerUnavailableError } from "../errors/index.js";
import type { RiskPeer } from "../interfaces/index.js";

export const RISK_PROCEDURE = Object.freeze({
  EVALUATE: "risk.evaluate",
});

export function createRiskPeer(client: RPCClient): RiskPeer {
  return {
    evaluate: async (request, requestId) => {
      let answer: unknown;

      try {
        answer = await client.call<RiskEvaluateRequest, unknown>(
          RISK_PROCEDURE.EVALUATE,
          request,
          { metadata: createRPCMetadata({ requestId }) },
        );
      } catch (error) {
        throw classifyPeerFailure("risk", error);
      }

      const decision = validate(riskDecisionSchema, answer);

      if (!decision.success) {
        throw new PeerUnavailableError(
          "risk",
          new Error("The decision did not match the contract."),
        );
      }

      return decision.data satisfies RiskDecision;
    },
  };
}
