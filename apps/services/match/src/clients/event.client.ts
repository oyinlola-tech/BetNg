import { createRpcClient } from "@betng/service-kit";
import type { ServiceEndpoint } from "@betng/service-kit";
import type { RPCClient } from "@zudojs/rpc";
import { z } from "@zudojs/validation";
import type { ValidationSchema } from "@zudojs/validation";
import type { EventPeer } from "../interfaces/index.js";
import { callValidated } from "./rpc.client.js";

export const EVENT_PROCEDURE = Object.freeze({
  PUBLISH: "event.publish",
  PUBLISH_SIGNAL: "event.publishSignal",
});

/** Subscribers of `system` re-read over REST on this signal, which is how they catch up after a stream outage. */
const RESYNC_SIGNAL = Object.freeze({
  channel: "system",
  type: "SYSTEM_STATUS_UPDATED",
});

/** The stream is a projection; a slow event service must not hold the scheduler's tick. */
const PUBLISH_TIMEOUT_MS = 1500;

const publishResultSchema: ValidationSchema<{ readonly sequence: number }> =
  z.object({
    sequence: z.int().min(0),
  });

export function createEventClient(
  endpoint: ServiceEndpoint,
): EventPeer & { readonly raw: RPCClient } {
  const raw = createRpcClient(endpoint, {
    timeoutMs: Math.min(endpoint.timeoutMs, PUBLISH_TIMEOUT_MS),
  });

  return {
    raw,
    publish: async (event, requestId) =>
      callValidated(
        raw,
        EVENT_PROCEDURE.PUBLISH,
        event,
        requestId,
        publishResultSchema,
      ),
    resync: async (requestId) =>
      callValidated(
        raw,
        EVENT_PROCEDURE.PUBLISH_SIGNAL,
        RESYNC_SIGNAL,
        requestId,
        publishResultSchema,
      ),
  };
}
