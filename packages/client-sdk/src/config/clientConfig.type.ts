/**
 * What a BetNG client needs to know to reach the platform.
 *
 * Two addresses, because the two are genuinely different things: REST goes
 * through the gateway, and the live stream is a direct WebSocket to the
 * event service. A client is given both rather than deriving one from the
 * other, so a deployment can put them behind different hosts.
 */

export interface BetNgClientConfig {
  readonly gatewayUrl: string;
  readonly liveUrl: string;
  readonly timeoutMs?: number;
  /** The bearer token for the signed-in customer, cashier or admin. Read per request so a login takes effect at once. */
  readonly getToken?: () => string | undefined;
  /** Called when the platform rejects the token, so the app can show its session-expired state. */
  readonly onUnauthorized?: () => void;
}

export const DEFAULT_TIMEOUT_MS = 10_000;
