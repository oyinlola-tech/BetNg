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
import { assertInternalTokenConfigured } from "../internalAuth/index.js";
import { registerRpcRoute } from "../rpc/index.js";
import { createErrorHandler } from "../httpError/index.js";
import {
  createAccessLogMiddleware,
  createRequestIdMiddleware,
} from "../httpMiddleware/index.js";
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
}

export interface ServiceServer {
  readonly router: HttpRouter;
  readonly server: HttpServer;
  readonly port: number;
  readonly start: () => Promise<void>;
  readonly stop: () => Promise<void>;
}

const MAX_BODY_BYTES = 256 * 1024;

export function createServiceServer(
  options: ServiceServerOptions,
): ServiceServer {
  const { config, logger } = options;

  assertInternalTokenConfigured();

  const router = createRouter(createRouterFallbacks());
  registerHealthRoutes(router, config, options.probes ?? []);

  if (options.rpcServer !== undefined) {
    registerRpcRoute(router, options.rpcServer, logger);
  }

  options.routes(router);

  const pipeline = new HttpMiddlewarePipeline();
  pipeline.use(createRequestIdMiddleware(), { name: "request-id" });
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
      maxBodySize: MAX_BODY_BYTES,
      ...(options.server === undefined ? {} : { server: options.server }),
    }),
    handler: async (request: HttpRequestContext) =>
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
