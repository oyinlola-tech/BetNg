import type { HttpRouterContext } from "@betng/service-kit";

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
