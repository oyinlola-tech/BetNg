export interface BetNgClientConfig {
  readonly gatewayUrl: string;
  readonly liveUrl: string;
  readonly timeoutMs?: number;
  /** The bearer token for the signed-in customer, cashier or admin. Read per request so a login takes effect at once. */
  readonly getToken?: () => string | undefined;
  /** Called when the platform rejects the token, so the app can show its session-expired state. */
  readonly onUnauthorized?: () => void;
  /** Retries for idempotent reads that failed in transit or with 502/503/504. Defaults to 2. */
  readonly retries?: number;
  readonly realtimeTransport?: "websocket" | "sse";
  /** Called for every failed request with no body or credential in it, for a client's logger. */
  readonly onRequestError?: (failure: RequestFailure) => void;
}

export interface RequestFailure {
  readonly method: string;
  readonly path: string;
  readonly status: number;
  readonly code: string;
  readonly kind: "http" | "network" | "timeout" | "offline" | "parse";
  readonly requestId: string;
  readonly durationMs: number;
  readonly attempt: number;
}

export const DEFAULT_TIMEOUT_MS = 10_000;
