import { createRpcClient } from "@betng/service-kit";
import type { ServiceEndpoint } from "@betng/service-kit";
import type { RPCClient } from "@zudojs/rpc";
import { z } from "@zudojs/validation";
import type { ValidationSchema } from "@zudojs/validation";
import type { RiskPeer } from "../interfaces/index.js";
import { callValidated } from "./rpc.client.js";

export const RISK_PROCEDURE = Object.freeze({
  FREEZE_EXPOSURE: "risk.freezeExposure",
});

const freezeResultSchema: ValidationSchema<{
  readonly matchId: string;
  readonly frozenAt: string;
}> = z.object({
  matchId: z.uuid(),
  frozenAt: z.string().min(1).max(64),
});

export function createRiskClient(
  endpoint: ServiceEndpoint,
): RiskPeer & { readonly raw: RPCClient } {
  const raw = createRpcClient(endpoint);

  return {
    raw,
    freezeExposure: async (matchId, requestId) =>
      callValidated(
        raw,
        RISK_PROCEDURE.FREEZE_EXPOSURE,
        { matchId },
        requestId,
        freezeResultSchema,
      ),
  };
}
