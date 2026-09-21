import { createRpcClient } from "@betng/service-kit";
import type { ServiceEndpoint } from "@betng/service-kit";
import type { RPCClient } from "@zudojs/rpc";
import { z } from "@zudojs/validation";
import type { ValidationSchema } from "@zudojs/validation";
import type { IdentityPeer } from "../interfaces/index.js";
import { callValidated } from "./rpc.client.js";

export const IDENTITY_PROCEDURE = Object.freeze({ RECORD_AUDIT: "identity.recordAudit" });

const auditResultSchema: ValidationSchema<{ readonly id: string }> = z.object({ id: z.string().min(1).max(64) });

export function createIdentityClient(endpoint: ServiceEndpoint): IdentityPeer & { readonly raw: RPCClient } {
  const raw = createRpcClient(endpoint);

  return {
    raw,
    recordAudit: async (entry) =>
      callValidated(raw, IDENTITY_PROCEDURE.RECORD_AUDIT, entry, entry.requestId, auditResultSchema),
  };
}
