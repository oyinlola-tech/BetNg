import type { Logger } from "@betng/service-kit";
import { createRPCMetadata } from "@zudojs/rpc";
import type { RPCClient } from "@zudojs/rpc";
import type { BetSignalPublisher } from "../interfaces/index.js";

export const EVENT_PROCEDURE = Object.freeze({ PUBLISH_SIGNAL: "event.publishSignal" });

export function createBetSignalPublisher(client: RPCClient, logger: Logger): BetSignalPublisher {
  const publish = (channel: string, betId: string, requestId: string): void => {
    client
      .call<unknown, unknown>(
        EVENT_PROCEDURE.PUBLISH_SIGNAL,
        { channel, type: "BET_ACCEPTED", payload: { betId } },
        { metadata: createRPCMetadata({ requestId }) },
      )
      .catch(() => {
        logger.warn("Realtime signal was not published", { requestId, event: "signal_not_published" });
      });
  };

  return {
    betAccepted: (customerId, betId, requestId) => {
      publish(`user:${customerId}`, betId, requestId);
      publish(`bets:${customerId}`, betId, requestId);
    },
  };
}
