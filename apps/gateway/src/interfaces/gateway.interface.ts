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

export interface GatewayRoute {
  readonly method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly path: string;
  readonly upstream: UpstreamName;
  readonly access: RouteAccess;
  readonly rateLimit?: RateLimitRule;
}

export interface ActorResolver {
  resolve(token: string, requestId: string): Promise<Actor>;
  close(): Promise<void>;
}

export interface RateLimiter {
  hit(key: string, rule: RateLimitRule): Promise<void>;
}
