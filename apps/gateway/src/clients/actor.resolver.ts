/**
 * Turns a bearer token into an actor by asking the identity service.
 *
 * The gateway is the only place a session token is looked at. A resolved actor is cached briefly in Redis under
 * the token's SHA-256 (never the token itself), so a burst of requests costs one identity call and a revoked
 * session stops working within `cacheSeconds`. Without Redis every request asks identity.
 */

import { createHash } from "node:crypto";
import { ErrorCodes } from "@betng/contracts";
import { createRpcClient, serviceUnavailable, unauthorized } from "@betng/service-kit";
import type { Actor, ActorKind, Logger, RedisConnection, ServiceEndpoint } from "@betng/service-kit";
import { createRPCMetadata, isRPCError } from "@zudojs/rpc";
import type { ActorResolver } from "../interfaces/index.js";

const AUTHENTICATE = "identity.authenticate";

const SESSION_CODES: readonly string[] = [
  ErrorCodes.UNAUTHENTICATED,
  ErrorCodes.SESSION_EXPIRED,
  ErrorCodes.FORBIDDEN,
];

interface AuthenticateResult {
  readonly kind: ActorKind;
  readonly id: string;
  readonly role: string;
  readonly name: string;
  readonly shopId?: string;
  readonly permissions: readonly string[];
  readonly expiresAt: string;
}

export interface ActorResolverOptions {
  readonly identity: ServiceEndpoint;
  readonly redis?: RedisConnection;
  readonly cacheSeconds: number;
  readonly logger: Logger;
}

function cacheKey(token: string): string {
  return `gateway:actor:${createHash("sha256").update(token).digest("hex")}`;
}

function toActor(result: AuthenticateResult): Actor {
  return {
    kind: result.kind,
    id: result.id,
    role: result.role,
    name: result.name,
    ...(result.shopId === undefined ? {} : { shopId: result.shopId }),
    permissions: result.permissions,
  };
}

export function createActorResolver(options: ActorResolverOptions): ActorResolver {
  const client = createRpcClient(options.identity);
  const { redis, cacheSeconds, logger } = options;

  async function readCache(key: string): Promise<Actor | undefined> {
    if (redis === undefined || cacheSeconds === 0) return undefined;

    try {
      await redis.connect();
      const cached = await redis.client.get(key);

      return cached === null ? undefined : (JSON.parse(cached) as Actor);
    } catch {
      return undefined;
    }
  }

  async function writeCache(key: string, actor: Actor, expiresAt: string): Promise<void> {
    if (redis === undefined || cacheSeconds === 0) return;

    const remaining = Math.floor((Date.parse(expiresAt) - Date.now()) / 1000);
    const ttl = Math.min(cacheSeconds, remaining);

    if (ttl <= 0) return;

    try {
      await redis.client.set(key, JSON.stringify(actor), { expiration: { type: "EX", value: ttl } });
    } catch {
      /* The cache is an optimisation; identity remains the authority. */
    }
  }

  return {
    resolve: async (token, requestId) => {
      const key = cacheKey(token);
      const cached = await readCache(key);

      if (cached !== undefined) return cached;

      try {
        const result = await client.call<{ token: string }, AuthenticateResult>(
          AUTHENTICATE,
          { token },
          { metadata: createRPCMetadata({ requestId }) },
        );

        const actor = toActor(result);
        await writeCache(key, actor, result.expiresAt);

        return actor;
      } catch (error) {
        const code = isRPCError(error) ? String(error.code) : undefined;

        if (code !== undefined && SESSION_CODES.includes(code)) {
          throw unauthorized(
            code === ErrorCodes.SESSION_EXPIRED
              ? "Your session has expired. Sign in again."
              : "Sign in to continue.",
            {
              code: code === ErrorCodes.SESSION_EXPIRED ? ErrorCodes.SESSION_EXPIRED : ErrorCodes.UNAUTHENTICATED,
              expose: true,
            },
          );
        }

        logger.error("Identity could not be asked to resolve a session", {
          requestId,
          code: code ?? "RPC_ERROR",
        });

        throw serviceUnavailable("Sign-in is temporarily unavailable.", {
          code: ErrorCodes.UPSTREAM_UNAVAILABLE,
          expose: true,
        });
      }
    },

    close: async () => {
      await client.close();
    },
  };
}
