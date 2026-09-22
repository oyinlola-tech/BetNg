import type { Logger } from "@betng/service-kit";
import { createRPCMetadata } from "@zudojs/rpc";
import type { RPCClient } from "@zudojs/rpc";

const PUBLISH_SIGNAL = "event.publishSignal";

/** Stateless "re-read me" signals on private channels. Best effort: never awaited by, or able to fail, a money path. */
export interface SignalPublisher {
  walletChanged(userId: string, requestId: string): void;
  shopChanged(shopId: string, requestId: string): void;
}

export function createSignalPublisher(client: RPCClient, logger: Logger): SignalPublisher {
  const publish = (channel: string, requestId: string): void => {
    client
      .call<unknown, unknown>(PUBLISH_SIGNAL, { channel, type: "WALLET_UPDATED" }, { metadata: createRPCMetadata({ requestId }) })
      .catch(() => {
        logger.warn("Realtime signal was not published", { requestId, event: "signal_not_published" });
      });
  };

  return {
    walletChanged: (userId, requestId) => {
      publish(`wallet:${userId}`, requestId);
      publish(`user:${userId}`, requestId);
    },
    shopChanged: (shopId, requestId) => {
      publish(`shop:${shopId}`, requestId);
    },
  };
}
