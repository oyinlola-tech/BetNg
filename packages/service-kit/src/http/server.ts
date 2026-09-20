/**
 * The HTTP bootstrap shared by every BetNG TypeScript service.
 *
 * A service supplies its configuration, its routes and its dependency
 * probes; this assembles the ZudoJS pieces around them:
 *
 *   `createNodeHttpAdapter` → `createHttpServer`
 *        handler  = middleware pipeline ending in `HttpRouter.dispatch`
 *        errorHandler = the BetNG error envelope
 *
 * The pipeline order matters. Request correlation runs first so every later
 * stage can log the id; access logging runs next so it times the whole
 * request including routing; the router runs last, as the terminal stage
 * that produces the response.
 */

import {
  createHttpServer,
  createNodeHttpAdapter,
  createResponseContext,
  createRouter,
  HttpMiddlewarePipeline,
  type HttpRequestContext,
  type HttpRouter,
  type HttpServer,
} from "@zudojs/http";
import { ErrorCodes } from "@betng/contracts";
import type { Logger } from "@zudojs/logger";
import type { ServiceConfig } from "../config/serviceConfig.js";
import type { DependencyProbe } from "../health/probes.js";
import { createErrorHandler, buildErrorBody } from "./errors.js";
import { createAccessLogMiddleware } from "./logging.js";
import { createRequestIdMiddleware, getRequestId } from "./requestId.js";
import { registerHealthRoutes } from "./healthRoutes.js";

export interface ServiceServerOptions {
  readonly config: ServiceConfig;
  readonly logger: Logger;
  /** Registers this service's domain routes. Health routes are added here. */
  readonly routes: (router: HttpRouter) => void;
  /** The dependencies `/ready` probes. Empty when the service has none. */
  readonly probes?: readonly DependencyProbe[];
}

export interface ServiceServer {
  readonly router: HttpRouter;
  readonly start: () => Promise<void>;
  readonly stop: () => Promise<void>;
  /** The port actually bound. Differs from the configured port only when 0. */
  readonly port: number;
  readonly server: HttpServer;
}

/**
 * The router's own 404 and 405, rendered as the BetNG envelope so a missing
 * route looks like every other failure to a client.
 */
function createRouterFallbacks(): Parameters<typeof createRouter>[0] {
  return {
    notFoundHandler: (context) =>
      createResponseContext({ status: 404 }).json(
        buildErrorBody({
          code: ErrorCodes.NOT_FOUND,
          message: `No route matches ${context.method} ${context.path}.`,
          requestId: getRequestId(context.request),
        }),
      ),
    methodNotAllowedHandler: (context, allowed) =>
      createResponseContext({ status: 405 })
        .setHeader("allow", allowed.join(", "))
        .json(
          buildErrorBody({
            code: ErrorCodes.METHOD_NOT_ALLOWED,
            message:
              `${context.method} is not allowed on ${context.path}. ` +
              `Allowed: ${allowed.join(", ")}.`,
            requestId: getRequestId(context.request),
          }),
        ),
  };
}

export function createServiceServer(
  options: ServiceServerOptions,
): ServiceServer {
  const { config, logger } = options;

  const router = createRouter(createRouterFallbacks());
  registerHealthRoutes(router, config, options.probes ?? []);
  options.routes(router);

  const pipeline = new HttpMiddlewarePipeline();
  pipeline.use(createRequestIdMiddleware(), { name: "request-id" });
  pipeline.use(createAccessLogMiddleware(logger), { name: "access-log" });
  pipeline.use(async (context) => {
    // Terminal stage: never calls next(), so the router produces the response.
    const result = await router.dispatch(context.request, {
      signal: context.signal,
    });
    return result.response;
  }, { name: "router" });

  const adapter = createNodeHttpAdapter({
    host: config.host,
    port: config.port,
    // 256 KiB is far more than any BetNG payload; a larger body is refused
    // before it is buffered rather than after.
    maxBodySize: 256 * 1024,
  });

  const server = createHttpServer({
    name: config.serviceName,
    adapter,
    // The pipeline creates the abort signal the stages share; the request
    // context carries no signal of its own.
    handler: (request: HttpRequestContext) =>
      pipeline.execute(request, createResponseContext()),
    errorHandler: createErrorHandler(logger),
  });

  return {
    router,
    server,
    get port(): number {
      return server.address?.port ?? config.port;
    },
    start: async () => {
      await server.start();
      logger.info("Service listening", {
        host: config.host,
        port: server.address?.port ?? config.port,
        environment: config.environment,
      });
    },
    stop: async () => {
      await server.stop();
      logger.info("Service stopped");
    },
  };
}
