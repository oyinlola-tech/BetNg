import { createRpcClient } from "@betng/service-kit";
import type { ServiceEndpoint } from "@betng/service-kit";
import { createRPCMetadata } from "@zudojs/rpc";
import type { RPCClient } from "@zudojs/rpc";
import type {
  AuditEntry,
  CustomerNotification,
  IdentityPeer,
  NotifyResult,
} from "../interfaces/index.js";

export const IDENTITY_PROCEDURE = Object.freeze({
  RECORD_AUDIT: "identity.recordAudit",
  NOTIFY: "identity.notify",
});

export interface IdentityClient extends IdentityPeer {
  readonly raw: RPCClient;
}

export function createIdentityClient(endpoint: ServiceEndpoint): IdentityClient {
  const client = createRpcClient(endpoint);

  return {
    raw: client,
    recordAudit: async (entry) =>
      client.call<AuditEntry, { readonly id: string }>(
        IDENTITY_PROCEDURE.RECORD_AUDIT,
        entry,
        { metadata: createRPCMetadata({ requestId: entry.requestId }) },
      ),
    notify: async (notification, requestId) =>
      client.call<CustomerNotification, NotifyResult>(IDENTITY_PROCEDURE.NOTIFY, notification, {
        metadata: createRPCMetadata({ requestId }),
      }),
  };
}
