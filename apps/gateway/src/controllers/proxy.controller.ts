/**
 * The gateway's forwarding handlers.
 *
 * Each handler names one upstream and forwards the request unchanged. The
 * gateway does not re-validate a domain payload: the owning service is the
 * authority on what it accepts, and duplicating its schema here would mean
 * two places to change and one of them eventually forgotten.
 *
 * What the gateway does own is the API surface — which routes exist, at
 * which version, and which service answers them.
 */

import { createResponseContext, readJsonBody } from "@betng/service-kit";
import type { HttpResponseContext, HttpRouterContext } from "@betng/service-kit";
import { forward, upstreamPath } from "../services/index.js";
import type { UpstreamClients, UpstreamName } from "../interfaces/index.js";

/** A handler that forwards one route to its owning service. */
export type ProxyHandler = (
  context: HttpRouterContext,
) => Promise<HttpResponseContext>;

/**
 * Builds a handler that forwards a read to an upstream service.
 *
 * @param clients - The upstream clients.
 * @param upstream - The service that owns the data.
 * @returns A route handler.
 */
export function proxyRead(
  clients: UpstreamClients,
  upstream: UpstreamName,
): ProxyHandler {
  return async (context) => {
    const response = await forward<unknown>(clients, context, {
      upstream,
      method: "GET",
      path: upstreamPath(context),
    });

    return createResponseContext({ status: response.status }).json(
      response.data,
    );
  };
}

/**
 * Builds a handler that forwards a write to an upstream service.
 *
 * The upstream's status is passed through unchanged, so a validation
 * failure reaches the client as the 422 the owning service decided on
 * rather than being flattened into a generic gateway error.
 *
 * @param clients - The upstream clients.
 * @param upstream - The service that owns the data.
 * @param method - The HTTP method to forward with.
 * @returns A route handler.
 */
export function proxyWrite(
  clients: UpstreamClients,
  upstream: UpstreamName,
  method: "POST" | "PUT" | "PATCH" | "DELETE" = "POST",
): ProxyHandler {
  return async (context) => {
    const response = await forward<unknown>(clients, context, {
      upstream,
      method,
      path: upstreamPath(context),
      body: readJsonBody(context.request),
    });

    return createResponseContext({ status: response.status }).json(
      response.data,
    );
  };
}
