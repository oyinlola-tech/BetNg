/**
 * Pipeline order matters: correlation first so every later stage can log
 * the identifier, access logging next so it times routing too, the router
 * last as the terminal stage.
 */

import {
  createHttpServer,
  createNodeHttpAdapter,
  createResponseContext,
  createRouter,
  HttpMiddlewarePipeline,
} from "@zudojs/http";
import type {
  HttpMiddleware,
  HttpRequestContext,
  HttpRouter,
  HttpServer,
} from "@zudojs/http";
import type { Server } from "node:http";
import type { RPCServer } from "@zudojs/rpc";
import type { Logger } from "@zudojs/logger";
import type { ServiceConfig } from "../serviceConfig/index.js";
import type { DependencyProbe } from "../healthProbe/index.js";
import { assertInternalTokenConfigured, setServiceIdentity } from "../internalAuth/index.js";
import { registerRpcRoute, rpcRateLimiterFromEnv } from "../rpc/index.js";
import { ErrorCodes } from "@betng/contracts";
import { buildErrorBody, createErrorHandler } from "../httpError/index.js";
import {
  createAccessLogMiddleware,
  createRequestIdMiddleware,
  getRequestId,
} from "../httpMiddleware/index.js";
import { isInternalRequest } from "../internalAuth/index.js";
import {
  createMetricsMiddleware,
  createMetricsRegistry,
  METRICS_CONTENT_TYPE,
  METRICS_PATH,
} from "../metrics/index.js";
import type { MetricsRegistry } from "../metrics/index.js";
import { registerHealthRoutes } from "./healthRoute.registrar.js";
import { createRouterFallbacks } from "./routerFallback.handler.js";

export interface ServiceServerOptions {
  readonly config: ServiceConfig;
  readonly logger: Logger;
  readonly routes: (router: HttpRouter) => void;
  readonly probes?: readonly DependencyProbe[];
  /**
   * The service's RPC procedures. When present they are mounted at
   * `POST /rpc` on this same listener, so RPC needs no second port.
   */
  readonly rpcServer?: RPCServer;
  /**
   * An HTTP server to serve on instead of one the adapter creates.
   *
   * Supplying one is how a service adds a protocol the ZudoJS HTTP adapter
   * does not own — the event service attaches its WebSocket upgrade handler
   * to this server, so REST and the live stream share one port. The node
   * adapter reattaches only its own `request` listener, leaving `upgrade`
   * alone.
   */
  readonly server?: Server;
  readonly middlewares?: readonly {
    readonly name: string;
    readonly middleware: HttpMiddleware;
  }[];
  /** Hard cap the adapter enforces while reading a body; defaults to 256 KiB. */
  readonly maxBodyBytes?: number;
  /** Which peers may set `x-forwarded-for`; off unless the service sits behind a known proxy. */
  readonly trustProxy?: boolean | number | string | readonly string[];
  /** How long in-flight requests may drain on stop before sockets are cut. */
  readonly shutdownGraceMs?: number;
}

export interface ServiceServer {
  readonly router: HttpRouter;
  readonly server: HttpServer;
  readonly port: number;
  readonly metrics: MetricsRegistry;
  readonly start: () => Promise<void>;
  readonly stop: () => Promise<void>;
}

const MAX_BODY_BYTES = 256 * 1024;

export const DEFAULT_SHUTDOWN_GRACE_MS = 10_000;

function drainFromEnv(env: Readonly<Record<string, string | undefined>> = process.env): number {
  const raw = env["SHUTDOWN_DRAIN_MS"];
  const value = raw === undefined || raw === "" ? DEFAULT_SHUTDOWN_GRACE_MS : Number(raw);

  if (!Number.isInteger(value) || value < 0 || value > 60_000) {
    throw new Error(`SHUTDOWN_DRAIN_MS must be an integer between 0 and 60000, got "${String(raw)}".`);
  }

  return value;
}

export function createServiceServer(
  options: ServiceServerOptions,
): ServiceServer {
  const { config, logger } = options;

  assertInternalTokenConfigured();
  setServiceIdentity(config.serviceName);

  const router = createRouter(createRouterFallbacks());
  registerHealthRoutes(router, config, options.probes ?? []);

  if (options.rpcServer !== undefined) {
    registerRpcRoute(router, options.rpcServer, logger, rpcRateLimiterFromEnv());
  }

  const metrics = createMetricsRegistry(config.serviceName);

  // Internal-only: without the internal token it answers 404, and the gateway never proxies it.
  router.get(METRICS_PATH, (context) =>
    isInternalRequest(context.request)
      ? createResponseContext({ status: 200 })
          .text(metrics.render())
          .setContentType(METRICS_CONTENT_TYPE)
      : createResponseContext({ status: 404 }).json(
          buildErrorBody({
            code: ErrorCodes.NOT_FOUND,
            message: `No route matches GET ${METRICS_PATH}.`,
            requestId: getRequestId(context.request),
          }),
        ),
  );

  options.routes(router);

  const pipeline = new HttpMiddlewarePipeline();
  pipeline.use(createRequestIdMiddleware(), { name: "request-id" });
  pipeline.use(createMetricsMiddleware(metrics, router), { name: "metrics" });
  pipeline.use(createAccessLogMiddleware(logger), { name: "access-log" });

  for (const entry of options.middlewares ?? []) {
    pipeline.use(entry.middleware, { name: entry.name });
  }
  pipeline.use(
    async (context) => {
      const result = await router.dispatch(context.request, {
        signal: context.signal,
      });

      return result.response;
    },
    { name: "router" },
  );

  const server = createHttpServer({
    name: config.serviceName,
    adapter: createNodeHttpAdapter({
      host: config.host,
      port: config.port,
      maxBodySize: options.maxBodyBytes ?? MAX_BODY_BYTES,
      ...(options.trustProxy === undefined ? {} : { trustProxy: options.trustProxy }),
      ...(options.server === undefined ? {} : { server: options.server }),
    }),
    gracefulShutdownTimeout: options.shutdownGraceMs ?? drainFromEnv(),
    handler: async (request: HttpRequestContext) =>
      pipeline.execute(request, createResponseContext()),
    errorHandler: createErrorHandler(logger),
  });

  return {
    router,
    server,
    metrics,

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
