// The upstream request is built from scratch: no inbound header is forwarded, so a client cannot forge `x-betng-*`.

import { ErrorCodes } from "@betng/contracts";
import {
  actorHeaders,
  createResponseContext,
  forbidden,
  getRequestId,
  readJsonBody,
  unauthorized,
} from "@betng/service-kit";
import type { Actor, HttpResponseContext, HttpRouterContext } from "@betng/service-kit";
import { upstreamPath } from "../services/index.js";
import type {
  ActorResolver,
  GatewayRoute,
  RateLimiter,
  UpstreamClients,
} from "../interfaces/index.js";

const BEARER = /^Bearer ([A-Za-z0-9._~+/=-]{16,512})$/;
const SAFE_IDEMPOTENCY_KEY = /^[A-Za-z0-9_.:-]{8,120}$/;

export type ProxyHandler = (context: HttpRouterContext) => Promise<HttpResponseContext>;

export interface ProxyDependencies {
  readonly clients: UpstreamClients;
  readonly actors: ActorResolver;
  readonly limiter: RateLimiter;
}

function bearerToken(context: HttpRouterContext): string | undefined {
  return BEARER.exec(context.request.getHeader("authorization") ?? "")?.[1];
}

function signInRequired(): never {
  throw unauthorized("Sign in to continue.", { code: ErrorCodes.UNAUTHENTICATED, expose: true });
}

async function authorise(
  route: GatewayRoute,
  context: HttpRouterContext,
  actors: ActorResolver,
): Promise<{ readonly actor?: Actor; readonly token?: string }> {
  if (route.access.type === "public") return {};

  const token = bearerToken(context) ?? signInRequired();

  if (route.access.type === "token") return { token };

  const actor = await actors.resolve(token, getRequestId(context.request));

  const allowed =
    route.access.kinds.includes(actor.kind) &&
    (route.access.permission === undefined || actor.permissions.includes(route.access.permission));

  if (!allowed) {
    throw forbidden("You do not have permission to do this.", { code: ErrorCodes.FORBIDDEN, expose: true });
  }

  return { actor };
}

export function createProxyHandler(route: GatewayRoute, dependencies: ProxyDependencies): ProxyHandler {
  const { clients, actors, limiter } = dependencies;

  return async (context) => {
    if (route.rateLimit !== undefined) {
      const address = context.request.remoteAddress ?? "unknown";

      await limiter.hit(`${route.path}:${address}`, route.rateLimit);
    }

    const { actor, token } = await authorise(route, context, actors);
    const idempotencyKey = context.request.getHeader("idempotency-key");

    const headers: Record<string, string> = {
      ...(actor === undefined ? {} : actorHeaders(actor)),
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
      ...(idempotencyKey !== undefined && SAFE_IDEMPOTENCY_KEY.test(idempotencyKey)
        ? { "idempotency-key": idempotencyKey }
        : {}),
    };

    const response = await clients[route.upstream].request<unknown>({
      method: route.method,
      path: upstreamPath(context),
      requestId: getRequestId(context.request),
      headers,
      ...(route.method === "GET" ? {} : { body: readJsonBody(context.request) ?? {} }),
    });

    const reply = createResponseContext({ status: response.status });

    return response.status === 204 || response.data === "" ? reply : reply.json(response.data);
  };
}
