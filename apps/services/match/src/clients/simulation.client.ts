/**
 * The match service's RPC client for the simulation service.
 *
 * `runMatch` carries the match id and the two teams and nothing else: the simulation has no access path to a
 * stake, a bettor or an exposure figure, and this client is where that is visible.
 */

import { runMatchResponseSchema } from "@betng/contracts";
import type { RunMatchResponse } from "@betng/contracts";
import { createRpcClient } from "@betng/service-kit";
import type { ServiceEndpoint } from "@betng/service-kit";
import type { RPCClient } from "@zudojs/rpc";
import type { ValidationSchema } from "@zudojs/validation";
import type { SimulationPeer } from "../interfaces/index.js";
import { callValidated } from "./rpc.client.js";

export const SIMULATION_PROCEDURE = Object.freeze({ RUN_MATCH: "simulation.runMatch" });

const RUN_MATCH_TIMEOUT_MS = 10_000;

const responseSchema: ValidationSchema<RunMatchResponse> = runMatchResponseSchema;

export function createSimulationClient(endpoint: ServiceEndpoint): SimulationPeer & { readonly raw: RPCClient } {
  const raw = createRpcClient(endpoint, { timeoutMs: Math.max(endpoint.timeoutMs, RUN_MATCH_TIMEOUT_MS) });

  return {
    raw,
    runMatch: async (request, requestId) =>
      callValidated(raw, SIMULATION_PROCEDURE.RUN_MATCH, request, requestId, responseSchema),
  };
}
