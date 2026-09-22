import type { IncomingMessage } from "node:http";
import { canonicalIp } from "@betng/service-kit";

// With N trusted proxies in front, the client is the Nth address from the right of x-forwarded-for.
export function clientAddress(request: IncomingMessage, trustedProxyHops: number): string {
  const peer = canonicalIp(request.socket.remoteAddress ?? "unknown");

  if (trustedProxyHops === 0) return peer;

  const header = request.headers["x-forwarded-for"];
  const hops = (Array.isArray(header) ? header.join(",") : (header ?? ""))
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
  const candidate = hops[hops.length - trustedProxyHops];

  return candidate === undefined ? peer : canonicalIp(candidate);
}

export function queryToken(request: IncomingMessage): string | undefined {
  const token = new URL(request.url ?? "/", "http://live.invalid").searchParams.get("access_token");

  return token === null || token === "" ? undefined : token;
}
