import {
  createRealtimeClient,
  createRestClient,
  sseTransport,
  webSocketTransport,
  type BetNgRestClient,
  type RealtimeClient,
} from "@betng/client-sdk";
import type { Logger } from "../logger.js";
import type { ClientEnv } from "./clientEnv.js";

export interface PlatformClientOptions {
  readonly env: ClientEnv;
  readonly getToken: () => string | undefined;
  readonly onUnauthorized: () => void;
  readonly logger?: Logger;
}

export interface PlatformClients {
  readonly rest: BetNgRestClient;
  readonly realtime: RealtimeClient;
}

/** The REST and realtime clients a platform data source runs on, wired to one session and one logger. */
export function createPlatformClients(options: PlatformClientOptions): PlatformClients {
  const { env, logger } = options;

  const rest = createRestClient({
    gatewayUrl: env.apiUrl,
    liveUrl: env.realtimeUrl,
    timeoutMs: env.requestTimeoutMs,
    getToken: options.getToken,
    onUnauthorized: options.onUnauthorized,
    onRequestError: (failure) => {
      const level =
        failure.status >= 500 || failure.status === 0
          ? "error"
          : failure.status === 404
            ? "info"
            : "warn";

      logger?.[level]("api", `${failure.method} ${failure.path} failed`, { ...failure });
    },
  });

  const realtime = createRealtimeClient({
    url: env.realtimeUrl,
    transport: env.realtimeTransport === "sse" ? sseTransport() : webSocketTransport(),
    authMode: env.realtimeAuth,
    getToken: options.getToken,
    onUnauthorized: options.onUnauthorized,
    onProtocolError: (code) => {
      logger?.warn("realtime", "The realtime endpoint reported an error", { code });
    },
  });

  let last = realtime.status();

  realtime.onStatus((status) => {
    if (status === "RECONNECTING" || status === "FAILED") {
      logger?.warn("realtime", "Realtime connection lost", { status, previous: last });
    } else if (status === "CONNECTED" && last !== "CONNECTING") {
      logger?.info("realtime", "Realtime connection restored");
    }

    last = status;
  });

  return { rest, realtime };
}
