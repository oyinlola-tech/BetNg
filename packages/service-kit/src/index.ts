/**
 * @betng/service-kit
 *
 * The bootstrap every BetNG TypeScript service is built from.
 *
 * It exists so the five services share one implementation of the things
 * that must not drift between them — configuration loading, log shape,
 * request correlation, the error envelope, health semantics and the
 * outbound client — rather than five copies that slowly diverge.
 * Everything here is a thin arrangement of `@zudojs/*` packages; none of it
 * reimplements the framework.
 *
 * Domain logic belongs in the services, never here.
 */

export {
  DEFAULT_PORTS,
  DEFAULT_SERVICE_TIMEOUT_MS,
  loadServiceConfig,
  SERVICE_NAMES,
} from "./serviceConfig/index.js";
export type {
  Environment,
  LoadServiceConfigOptions,
  ServiceConfig,
  ServiceEndpoint,
  ServiceName,
} from "./serviceConfig/index.js";

export {
  createServiceLogger,
  createStdoutTransport,
  LoggerLevel,
  parseLogLevel,
  withRequestId,
} from "./serviceLogger/index.js";
export type { Logger } from "./serviceLogger/index.js";

export {
  createAccessLogMiddleware,
  createRequestIdMiddleware,
  getRequestId,
  REQUEST_ID_STATE,
} from "./httpMiddleware/index.js";

export {
  buildErrorBody,
  createErrorHandler,
  FALLBACK_ERROR_CODE,
  isErrorDetails,
  OPAQUE_ERROR_MESSAGE,
  toErrorDetails,
  unwrapStatusError,
} from "./httpError/index.js";
export type {
  ErrorBodyOptions,
  ServiceErrorHandler,
  StatusCarrying,
} from "./httpError/index.js";

export {
  parseBody,
  parseQuery,
  readJsonBody,
  requireParam,
} from "./httpRequest/index.js";

export {
  created,
  createRouterFallbacks,
  createServiceServer,
  json,
  registerHealthRoutes,
  withStatus,
} from "./httpServer/index.js";
export type {
  JsonHandler,
  RouteHandler,
  ServiceServer,
  ServiceServerOptions,
} from "./httpServer/index.js";

export { PROBE_TIMEOUT_MS, runProbes } from "./healthProbe/index.js";
export type {
  DependencyProbe,
  ReadinessOutcome,
} from "./healthProbe/index.js";

export {
  createPostgresPool,
  createRedisConnection,
  createServiceClient,
  postgresProbe,
  redisProbe,
  serviceProbe,
} from "./clients/index.js";
export type {
  PostgresPool,
  RedisConnection,
  ServiceClient,
  ServiceProbeOptions,
  ServiceRequest,
  ServiceResponse,
} from "./clients/index.js";

export { runService } from "./serviceRunner/index.js";
export type { RunnableService } from "./serviceRunner/index.js";

export {
  badRequest,
  conflict,
  createResponseContext,
  forbidden,
  HttpError,
  notFound,
  serviceUnavailable,
  unauthorized,
  unprocessableEntity,
} from "@zudojs/http";
export type {
  HttpRequestContext,
  HttpResponseContext,
  HttpRouter,
  HttpRouterContext,
} from "@zudojs/http";
