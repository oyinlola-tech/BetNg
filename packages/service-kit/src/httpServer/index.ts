export { created, json, withStatus } from "./routeHandler.adapter.js";
export type { JsonHandler, RouteHandler } from "./routeHandler.adapter.js";

export { registerHealthRoutes } from "./healthRoute.registrar.js";
export { createRouterFallbacks } from "./routerFallback.handler.js";

export { createServiceServer, DEFAULT_SHUTDOWN_GRACE_MS } from "./serviceServer.factory.js";
export type {
  ServiceServer,
  ServiceServerOptions,
} from "./serviceServer.factory.js";
