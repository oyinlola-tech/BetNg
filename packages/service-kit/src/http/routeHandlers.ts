/**
 * Adapters between a domain handler and a ZudoJS route handler.
 *
 * `HttpRouter` requires a handler to return a response context, not bare
 * data. Rather than have every controller build one, a controller returns
 * the value it wants to send and is wrapped here. That keeps the status code
 * visible at the route table — `json` for a read, `created` for a write that
 * makes something — instead of buried inside a handler body.
 */

import {
  createResponseContext,
  type HttpResponseContext,
  type HttpRouterContext,
} from "@zudojs/http";

/** A handler that returns the value to serialise as the response body. */
export type JsonHandler<T> = (context: HttpRouterContext) => T | Promise<T>;

/** A route handler, as `HttpRouter` expects one. */
export type RouteHandler = (
  context: HttpRouterContext,
) => Promise<HttpResponseContext>;

/** Serialises the handler's return value as JSON with the given status. */
export function withStatus<T>(
  status: number,
  handler: JsonHandler<T>,
): RouteHandler {
  return async (context) =>
    createResponseContext({ status }).json(await handler(context));
}

/** 200 OK. */
export function json<T>(handler: JsonHandler<T>): RouteHandler {
  return withStatus(200, handler);
}

/** 201 Created — for a request that brought a new resource into existence. */
export function created<T>(handler: JsonHandler<T>): RouteHandler {
  return withStatus(201, handler);
}
