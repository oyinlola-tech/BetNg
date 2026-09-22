import { createRpcClient } from "@betng/service-kit";
import type { ServiceEndpoint } from "@betng/service-kit";
import { createRPCMetadata } from "@zudojs/rpc";
import type { RPCClient } from "@zudojs/rpc";
import type { EventPeer } from "../interfaces/index.js";

export const EVENT_PROCEDURE = Object.freeze({ PUBLISH_SIGNAL: "event.publishSignal" });

export interface EventClient extends EventPeer {
  readonly raw: RPCClient;
}

export function createEventClient(endpoint: ServiceEndpoint): EventClient {
  const client = createRpcClient(endpoint);

  return {
    raw: client,
    publishSignal: async (channel, type, requestId, betId) => {
      await client.call(EVENT_PROCEDURE.PUBLISH_SIGNAL, { channel, type, payload: { betId } }, {
        metadata: createRPCMetadata({ requestId }),
      });
    },
  };
}
