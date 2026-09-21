/**
 * `HttpRouter` requires a response context, not bare data; a controller
 * returns the value and is wrapped here.
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
