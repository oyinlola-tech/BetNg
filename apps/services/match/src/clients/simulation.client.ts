import { runMatchResponseSchema } from "@betng/contracts";
import type { RunMatchResponse } from "@betng/contracts";
import { createRpcClient } from "@betng/service-kit";
import type { ServiceEndpoint } from "@betng/service-kit";
import type { RPCClient } from "@zudojs/rpc";
import { z } from "@zudojs/validation";
import type { ValidationSchema } from "@zudojs/validation";
import type { SimulationPeer, Squads } from "../interfaces/index.js";
import { callValidated } from "./rpc.client.js";

export const SIMULATION_PROCEDURE = Object.freeze({
  RUN_MATCH: "simulation.runMatch",
  GET_SQUADS: "simulation.getSquads",
});

const RUN_MATCH_TIMEOUT_MS = 10_000;

const responseSchema: ValidationSchema<RunMatchResponse> =
  runMatchResponseSchema;

const squadPlayerSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  shirt: z.int().min(1).max(99),
  position: z.enum(["GK", "DF", "MF", "FW"]),
});

const teamSquadSchema = z.object({
  teamId: z.uuid(),
  formation: z.string().max(12),
  starting: z.array(squadPlayerSchema).min(1).max(11),
  substitutes: z.array(squadPlayerSchema).max(15),
});

const squadsSchema: ValidationSchema<Squads> = z.object({
  home: teamSquadSchema,
  away: teamSquadSchema,
});

export function createSimulationClient(
  endpoint: ServiceEndpoint,
): SimulationPeer & { readonly raw: RPCClient } {
  const raw = createRpcClient(endpoint, {
    timeoutMs: Math.max(endpoint.timeoutMs, RUN_MATCH_TIMEOUT_MS),
  });

  return {
    raw,
    runMatch: async (request, requestId) =>
      callValidated(
        raw,
        SIMULATION_PROCEDURE.RUN_MATCH,
        request,
        requestId,
        responseSchema,
      ),
    getSquads: async (teams, requestId) =>
      callValidated(
        raw,
        SIMULATION_PROCEDURE.GET_SQUADS,
        teams,
        requestId,
        squadsSchema,
      ),
  };
}
