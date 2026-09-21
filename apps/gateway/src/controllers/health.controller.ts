import type { ServiceHealth } from "@betng/contracts";
import { getRequestId } from "@betng/service-kit";
import type { HttpRouterContext } from "@betng/service-kit";
import type { UpstreamClients, UpstreamName } from "../interfaces/index.js";

interface ReadyBody {
  readonly status?: string;
  readonly version?: string;
}

const STATUSES: readonly string[] = ["ok", "degraded", "unavailable"];

export function createHealthController(clients: UpstreamClients, gatewayVersion: string) {
  return async (context: HttpRouterContext): Promise<{ readonly items: readonly ServiceHealth[] }> => {
    const requestId = getRequestId(context.request);

    const upstreams = await Promise.all(
      (Object.keys(clients) as UpstreamName[]).map(async (name): Promise<ServiceHealth> => {
        const startedAt = performance.now();

        try {
          const response = await clients[name].request<ReadyBody>({ method: "GET", path: "/ready", requestId });
          const reported = response.data.status;

          return {
            service: name,
            status:
              reported !== undefined && STATUSES.includes(reported)
                ? (reported as ServiceHealth["status"])
                : response.status < 400
                  ? "ok"
                  : "unavailable",
            latencyMs: Math.round(performance.now() - startedAt),
            version: response.data.version ?? "unknown",
            checkedAt: new Date().toISOString(),
          };
        } catch {
          return {
            service: name,
            status: "unavailable",
            latencyMs: Math.round(performance.now() - startedAt),
            version: "unknown",
            checkedAt: new Date().toISOString(),
          };
        }
      }),
    );

    return {
      items: [
        { service: "gateway", status: "ok", latencyMs: 0, version: gatewayVersion, checkedAt: new Date().toISOString() },
        ...upstreams,
      ],
    };
  };
}
