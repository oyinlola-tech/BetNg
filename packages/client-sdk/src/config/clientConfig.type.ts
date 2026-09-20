/**
 * What a BetNG client needs to know to reach the platform.
 *
 * Two addresses, because the two are genuinely different things: REST goes
 * through the gateway, and the live stream is a direct WebSocket to the
 * event service. A client is given both rather than deriving one from the
 * other, so a deployment can put them behind different hosts.
 */

export interface BetNgClientConfig {
  /** The gateway's base URL. Every REST call goes here. */
  readonly gatewayUrl: string;
  /** The event service's WebSocket URL, e.g. `ws://localhost:3008/live`. */
  readonly liveUrl: string;
  /** How long a REST call may run before it is abandoned. */
  readonly timeoutMs?: number;
}

/** How long a REST call waits before giving up, when unspecified. */
export const DEFAULT_TIMEOUT_MS = 10_000;
