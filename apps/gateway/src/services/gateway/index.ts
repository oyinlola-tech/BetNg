import type { HttpRouterContext } from "@betng/service-kit";

/**
 * Rebuilds the upstream path from the inbound request.
 *
 * The gateway and the services share one URL space, so a request for
 * `/api/v1/matches/:id` is forwarded to the same path on the match
 * service. Keeping them identical means a route can be moved behind or out
 * from behind the gateway without a client noticing.
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
