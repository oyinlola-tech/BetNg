import { API_PREFIX } from "@betng/contracts";
import { json } from "@betng/service-kit";
import type { HttpRouter } from "@betng/service-kit";
import { createHealthController, createProxyHandler, guard } from "../controllers/index.js";
import type { ProxyDependencies } from "../controllers/index.js";
import type { GatewayRoute, RateLimitRule } from "../interfaces/index.js";

export interface GatewayRouteOptions extends ProxyDependencies {
  readonly table: readonly GatewayRoute[];
  readonly version: string;
  readonly healthLimit: RateLimitRule;
}

export function registerGatewayRoutes(router: HttpRouter, options: GatewayRouteOptions): void {
  for (const route of options.table) {
    router.on(route.method, `${API_PREFIX}${route.path}`, createProxyHandler(route, options));
  }

  const health = createHealthController(options.clients, options.version);
  const healthRoute = {
    access: { type: "actor", kinds: ["ADMIN"], permission: "health:read" },
    limits: [
      { name: "health", scope: "ip", rule: options.healthLimit, failClosed: false },
      { name: "health", scope: "actor", rule: options.healthLimit, failClosed: false },
    ],
  } as const;

  router.get(
    `${API_PREFIX}/admin/health/services`,
    json(async (context) => {
      await guard(healthRoute, context, options);

      return health(context);
    }),
  );
}
