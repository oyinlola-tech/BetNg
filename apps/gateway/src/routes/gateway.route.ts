import { API_PREFIX, ErrorCodes } from "@betng/contracts";
import { forbidden, getRequestId, json, unauthorized } from "@betng/service-kit";
import type { HttpRouter, HttpRouterContext } from "@betng/service-kit";
import { createHealthController, createProxyHandler } from "../controllers/index.js";
import type { ProxyDependencies } from "../controllers/index.js";
import type { GatewayRoute } from "../interfaces/index.js";

const BEARER = /^Bearer ([A-Za-z0-9._~+/=-]{16,512})$/;

export interface GatewayRouteOptions extends ProxyDependencies {
  readonly table: readonly GatewayRoute[];
  readonly version: string;
}

export function registerGatewayRoutes(router: HttpRouter, options: GatewayRouteOptions): void {
  for (const route of options.table) {
    router.on(route.method, `${API_PREFIX}${route.path}`, createProxyHandler(route, options));
  }

  const health = createHealthController(options.clients, options.version);

  router.get(
    `${API_PREFIX}/admin/health/services`,
    json(async (context: HttpRouterContext) => {
      const token = BEARER.exec(context.request.getHeader("authorization") ?? "")?.[1];

      if (token === undefined) {
        throw unauthorized("Sign in to continue.", { code: ErrorCodes.UNAUTHENTICATED, expose: true });
      }

      const actor = await options.actors.resolve(token, getRequestId(context.request));

      if (actor.kind !== "ADMIN" || !actor.permissions.includes("health:read")) {
        throw forbidden("You do not have permission to do this.", { code: ErrorCodes.FORBIDDEN, expose: true });
      }

      return health(context);
    }),
  );
}
