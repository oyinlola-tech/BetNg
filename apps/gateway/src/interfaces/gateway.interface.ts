import type { Actor, ActorKind, ServiceClient } from "@betng/service-kit";

export interface UpstreamClients {
  readonly match: ServiceClient;
  readonly betting: ServiceClient;
  readonly wallet: ServiceClient;
  readonly settlement: ServiceClient;
  readonly simulation: ServiceClient;
  readonly odds: ServiceClient;
  readonly risk: ServiceClient;
  readonly analytics: ServiceClient;
  readonly identity: ServiceClient;
  readonly event: ServiceClient;
}

export type UpstreamName = keyof UpstreamClients;

/** `token`: identity reads the bearer itself (logout, me, session). `actor`: a resolved session of one of `kinds`. */
export type RouteAccess =
  | { readonly type: "public" }
  | { readonly type: "token" }
  | {
      readonly type: "actor";
      readonly kinds: readonly ActorKind[];
      readonly permission?: string;
    };

export interface RateLimitRule {
  readonly limit: number;
  readonly windowSeconds: number;
}

/** `ip` limits run before authentication, `actor` limits after it. A fail-closed limit answers 503 when Redis is unreachable. */
export interface RouteLimit {
  readonly name: string;
  readonly scope: "ip" | "actor";
  readonly rule: RateLimitRule;
  readonly failClosed: boolean;
}

/** Forwarded byte for byte with only the named provider headers; never re-serialised. */
export interface WebhookPassthrough {
  readonly signatureHeaders: readonly string[];
}

export interface GatewayRoute {
  readonly method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly path: string;
  readonly upstream: UpstreamName;
  readonly access: RouteAccess;
  readonly limits?: readonly RouteLimit[];
  readonly webhook?: WebhookPassthrough;
  /** Sends `x-betng-session-hash` (sha256 of the bearer) so identity can tell the caller's own session apart. */
  readonly sessionHash?: boolean;
  /** Forwards a truncated `user-agent` so identity can label the session's device. */
  readonly userAgent?: boolean;
}

export interface ActorResolver {
  resolve(token: string, requestId: string): Promise<Actor>;
  close(): Promise<void>;
}

export interface RateLimiter {
  hit(key: string, rule: RateLimitRule, options?: { readonly failClosed?: boolean }): Promise<void>;
}

export interface IpBlocklist {
  isBlocked(address: string): Promise<boolean>;
}
