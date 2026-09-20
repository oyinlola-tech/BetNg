/**
 * Adapters between a domain handler and a ZudoJS route handler.
 *
 * `HttpRouter` requires a handler to return a response context, not bare
 * data. Rather than have every controller build one, a controller returns
 * the value it wants to send and is wrapped here. That keeps the status
 * code visible in the route table — `json` for a read, `created` for a
 * write that makes something — instead of buried in a handler body.
 */

import { createResponseContext } from "@zudojs/http";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

export type JsonHandler<T> = (context: HttpRouterContext) => T | Promise<T>;

export type RouteHandler = (
  context: HttpRouterContext,
) => Promise<HttpResponseContext>;

export function withStatus<T>(
  status: number,
  handler: JsonHandler<T>,
): RouteHandler {
  return async (context) =>
    createResponseContext({ status }).json(await handler(context));
}

export function json<T>(handler: JsonHandler<T>): RouteHandler {
  return withStatus(200, handler);
}

export function created<T>(handler: JsonHandler<T>): RouteHandler {
  return withStatus(201, handler);
}
