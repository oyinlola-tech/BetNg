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

export type ProxyHandler = (
  context: HttpRouterContext,
) => Promise<HttpResponseContext>;

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
