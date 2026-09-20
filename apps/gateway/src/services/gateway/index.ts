/**
 * The gateway application service.
 *
 * The gateway has no CQRS handlers of its own: it holds no domain state,
 * so there is nothing for a command or a query to act on. What it does
 * have is one operation — forward a request to the service that owns the
 * data and hand back the answer — and that lives here.
 */

import { getRequestId } from "@betng/service-kit";
import type { HttpRouterContext, ServiceResponse } from "@betng/service-kit";
import type { UpstreamClients, UpstreamName } from "../../interfaces/index.js";

/** One forwarding instruction. */
export interface ForwardOptions {
  readonly upstream: UpstreamName;
  readonly method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** The path on the upstream service, already resolved. */
  readonly path: string;
  readonly body?: unknown;
}

/**
 * Forwards a request to an upstream service.
 *
 * The caller's correlation identifier travels with the call, so one
 * request can be followed from the gateway's log line through the
 * upstream's. An unreachable upstream becomes a 503 carrying
 * `UPSTREAM_UNAVAILABLE`; the client never sees a raw fetch failure.
 *
 * @param clients - The upstream clients.
 * @param context - The inbound request, for its correlation identifier.
 * @param options - Which upstream to call, and how.
 * @returns The upstream's status and body.
 */
export async function forward<T>(
  clients: UpstreamClients,
  context: HttpRouterContext,
  options: ForwardOptions,
): Promise<ServiceResponse<T>> {
  return clients[options.upstream].request<T>({
    method: options.method,
    path: options.path,
    requestId: getRequestId(context.request),
    ...(options.body === undefined ? {} : { body: options.body }),
  });
}

/**
 * Rebuilds the upstream path from the inbound request.
 *
 * The gateway and the services share one URL space, so a request for
 * `/api/v1/matches/:id` is forwarded to the same path on the match
 * service. Keeping them identical means a route can be moved behind or out
 * from behind the gateway without a client noticing.
 *
 * @param context - The inbound request.
 * @returns The upstream path, query string included.
 */
export function upstreamPath(context: HttpRouterContext): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(context.query)) {
    for (const entry of Array.isArray(value) ? value : [value]) {
      search.append(key, entry);
    }
  }

  const query = search.toString();

  return query === ""
    ? context.request.path
    : `${context.request.path}?${query}`;
}
