import { createResponseContext, created, json } from "@betng/service-kit";
import type { HttpRouterContext, JsonHandler, RouteHandler } from "@betng/service-kit";
import { guardDatabase } from "../middlewares/index.js";

export const ok = <T>(handler: JsonHandler<T>): RouteHandler => guardDatabase(json(handler));

export const made = <T>(handler: JsonHandler<T>): RouteHandler => guardDatabase(created(handler));

export function noContent(handler: (context: HttpRouterContext) => Promise<void>): RouteHandler {
  return guardDatabase(async (context) => {
    await handler(context);

    return createResponseContext({ status: 204 });
  });
}
