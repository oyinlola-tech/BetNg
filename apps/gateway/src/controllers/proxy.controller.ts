// The upstream request is built from scratch: no inbound header is forwarded, so a client cannot forge `x-betng-*`.

import { createHash } from "node:crypto";
import { ErrorCodes } from "@betng/contracts";
import {
  actorHeaders,
  canonicalIp,
  createResponseContext,
  forbidden,
  getRequestId,
  HttpError,
  readJsonBody,
  unauthorized,
} from "@betng/service-kit";
import type { Actor, HttpResponseContext, HttpRouterContext } from "@betng/service-kit";
import {
  assertCsrf,
  clearSessionCookies,
  COOKIE_SESSION_PLACEHOLDER,
  cookiesApply,
  cookieToken,
  issueSessionCookies,
  upstreamPath,
} from "../services/index.js";
import type { SessionCookiePolicy } from "../services/index.js";
import type {
  ActorResolver,
  GatewayRoute,
  RateLimiter,
  RouteAccess,
  RouteLimit,
  UpstreamClients,
} from "../interfaces/index.js";

const BEARER = /^Bearer ([A-Za-z0-9._~+/=-]{16,512})$/;
const SAFE_IDEMPOTENCY_KEY = /^[A-Za-z0-9_.:-]{8,120}$/;
const SAFE_HEADER_VALUE = /^[\x21-\x7e]{1,1024}$/;
const SAFE_CONTENT_TYPE = /^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+(?:\s*;\s*[A-Za-z0-9_-]+=[A-Za-z0-9_.-]+)?$/;

export const CLIENT_IP_HEADER = "x-betng-client-ip";
export const SESSION_HASH_HEADER = "x-betng-session-hash";

export type ProxyHandler = (context: HttpRouterContext) => Promise<HttpResponseContext>;

export interface BodyLimits {
  readonly maxBodyBytes: number;
  readonly webhookMaxBodyBytes: number;
}

export interface ProxyDependencies {
  readonly clients: UpstreamClients;
  readonly actors: ActorResolver;
  readonly limiter: RateLimiter;
  readonly bodyLimits: BodyLimits;
  readonly sessionCookie: SessionCookiePolicy;
}

export interface Guarded {
  readonly actor?: Actor;
  readonly token?: string;
  readonly viaCookie?: boolean;
}

export function clientAddress(context: HttpRouterContext): string {
  return canonicalIp(context.request.remoteAddress ?? "unknown");
}

function bearerToken(context: HttpRouterContext): string | undefined {
  return BEARER.exec(context.request.getHeader("authorization") ?? "")?.[1];
}

function signInRequired(): never {
  throw unauthorized("Sign in to continue.", { code: ErrorCodes.UNAUTHENTICATED, expose: true });
}

function bodyBytes(body: unknown): number {
  if (body instanceof Uint8Array) return body.byteLength;
  if (typeof body === "string") return Buffer.byteLength(body);

  return 0;
}

function assertBodySize(context: HttpRouterContext, limit: number): void {
  const declared = Number(context.request.getHeader("content-length") ?? "0");

  if ((Number.isFinite(declared) && declared > limit) || bodyBytes(context.request.body) > limit) {
    throw new HttpError(413, "The request body is too large.", {
      code: ErrorCodes.PAYLOAD_TOO_LARGE,
      expose: true,
    });
  }
}

async function applyLimits(
  limits: readonly RouteLimit[],
  scope: RouteLimit["scope"],
  subject: string,
  limiter: RateLimiter,
): Promise<void> {
  for (const entry of limits) {
    if (entry.scope === scope) {
      await limiter.hit(`${entry.name}:${scope}:${subject}`, entry.rule, { failClosed: entry.failClosed });
    }
  }
}

export async function guard(
  route: { readonly access: RouteAccess; readonly limits?: readonly RouteLimit[] },
  context: HttpRouterContext,
  dependencies: Pick<ProxyDependencies, "actors" | "limiter" | "sessionCookie">,
): Promise<Guarded> {
  const limits = route.limits ?? [];

  await applyLimits(limits, "ip", clientAddress(context), dependencies.limiter);

  if (route.access.type === "public") return {};

  const bearer = bearerToken(context);
  const fromCookie = bearer === undefined ? cookieToken(dependencies.sessionCookie, context) : undefined;
  const token = bearer ?? fromCookie ?? signInRequired();
  const viaCookie = fromCookie !== undefined;

  // A cookie rides along on cross-site requests; a bearer never does. Only the cookie path needs the CSRF proof.
  if (viaCookie) assertCsrf(context);

  if (route.access.type === "token") return { token, viaCookie };

  const actor = await dependencies.actors.resolve(token, getRequestId(context.request));

  const allowed =
    route.access.kinds.includes(actor.kind) &&
    (route.access.permission === undefined || actor.permissions.includes(route.access.permission));

  if (!allowed) {
    throw forbidden("You do not have permission to do this.", { code: ErrorCodes.FORBIDDEN, expose: true });
  }

  await applyLimits(limits, "actor", `${actor.kind}:${actor.id}`, dependencies.limiter);

  return { actor, token, viaCookie };
}

function webhookHeaders(route: GatewayRoute, context: HttpRouterContext): Record<string, string> {
  const headers: Record<string, string> = { [CLIENT_IP_HEADER]: clientAddress(context) };

  for (const name of route.webhook?.signatureHeaders ?? []) {
    const value = context.request.getHeader(name);

    if (value !== undefined && SAFE_HEADER_VALUE.test(value)) headers[name] = value;
  }

  return headers;
}

function rawBody(context: HttpRouterContext): Uint8Array {
  const body = context.request.body;

  if (body instanceof Uint8Array) return body;
  if (typeof body === "string") return new TextEncoder().encode(body);

  return new Uint8Array();
}

export function createProxyHandler(route: GatewayRoute, dependencies: ProxyDependencies): ProxyHandler {
  const { clients, bodyLimits } = dependencies;
  const bodyLimit = route.webhook === undefined ? bodyLimits.maxBodyBytes : bodyLimits.webhookMaxBodyBytes;

  return async (context) => {
    if (route.method !== "GET") assertBodySize(context, bodyLimit);

    const { actor, token, viaCookie } = await guard(route, context, dependencies);
    const idempotencyKey = context.request.getHeader("idempotency-key");
    const userAgent = route.userAgent === true ? context.request.getHeader("user-agent")?.replace(/[^\x20-\x7e]/g, "").slice(0, 256) : undefined;
    const requestId = getRequestId(context.request);

    const headers: Record<string, string> = {
      ...(actor === undefined ? {} : actorHeaders(actor)),
      ...(actor === undefined && token !== undefined ? { authorization: `Bearer ${token}` } : {}),
      ...(route.sessionHash === true && token !== undefined
        ? { [SESSION_HASH_HEADER]: createHash("sha256").update(token).digest("hex") }
        : {}),
      ...(userAgent === undefined || userAgent === "" ? {} : { "user-agent": userAgent }),
      ...(idempotencyKey !== undefined && SAFE_IDEMPOTENCY_KEY.test(idempotencyKey)
        ? { "idempotency-key": idempotencyKey }
        : {}),
    };

    const contentType = context.request.getHeader("content-type");

    const response =
      route.webhook === undefined
        ? await clients[route.upstream].request<unknown>({
            method: route.method,
            path: upstreamPath(context),
            requestId,
            headers,
            ...(route.method === "GET" ? {} : { body: readJsonBody(context.request) ?? {} }),
          })
        : await clients[route.upstream].request<unknown>({
            method: route.method,
            path: upstreamPath(context),
            requestId,
            headers: { ...headers, ...webhookHeaders(route, context) },
            rawBody: rawBody(context),
            ...(contentType !== undefined && SAFE_CONTENT_TYPE.test(contentType) ? { contentType } : {}),
          });

    const reply = createResponseContext({ status: response.status });

    if (route.download === true && response.status === 200 && typeof response.data === "string" && response.contentType?.startsWith("text/csv") === true) {
      const filename = /filename="?([A-Za-z0-9._-]{1,120})"?/.exec(response.contentDisposition ?? "")?.[1] ?? "export.csv";

      return reply
        .text(response.data)
        .setHeader("content-type", "text/csv; charset=utf-8")
        .setHeader("content-disposition", `attachment; filename="${filename}"`);
    }

    const data = route.cookie === undefined ? response.data : applySessionCookies(route, dependencies.sessionCookie, context, reply, response.status, response.data, viaCookie === true);

    return response.status === 204 || data === "" ? reply : reply.json(data);
  };
}

function sessionBody(data: unknown): { readonly token: string; readonly expiresAt: unknown } | undefined {
  if (typeof data !== "object" || data === null) return undefined;

  const { token, expiresAt } = data as { token?: unknown; expiresAt?: unknown };

  return typeof token === "string" ? { token, expiresAt } : undefined;
}

function applySessionCookies(
  route: GatewayRoute,
  policy: SessionCookiePolicy,
  context: HttpRouterContext,
  reply: HttpResponseContext,
  status: number,
  data: unknown,
  viaCookie: boolean,
): unknown {
  if (!policy.enabled) return data;

  if (route.cookie === "clear") {
    if (viaCookie || cookiesApply(policy, context)) clearSessionCookies(policy, reply);

    return data;
  }

  if (status < 200 || status >= 300) return data;

  if (route.cookie === "refresh") {
    if (!viaCookie) return data;

    const renewed = sessionBody(data);
    const current = cookieToken(policy, context);
    const next = renewed ?? (current === undefined ? undefined : { token: current, expiresAt: (data as { expiresAt?: unknown } | null)?.expiresAt });

    if (next === undefined) return data;

    issueSessionCookies(policy, context, reply, next, false);

    return renewed === undefined ? data : { ...(data as object), token: COOKIE_SESSION_PLACEHOLDER };
  }

  const session = sessionBody(data);

  if (session === undefined || !cookiesApply(policy, context)) return data;

  issueSessionCookies(policy, context, reply, session, true);

  return { ...(data as object), token: COOKIE_SESSION_PLACEHOLDER };
}
