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
  createRedisConnection,
  createServiceDatabase,
  createServiceClient,
  databaseProbe,
  redisProbe,
  serviceProbe,
} from "./clients/index.js";
export type {
  RedisConnection,
  ServiceDatabase,
  ServiceClient,
  ServiceProbeOptions,
  ServiceRequest,
  ServiceResponse,
} from "./clients/index.js";

export {
  createHttpRpcTransport,
  createRpcClient,
  registerRpcRoute,
  RPC_PATH,
} from "./rpc/index.js";
export type {
  HttpRpcTransportOptions,
  RpcClientOptions,
} from "./rpc/index.js";

export { createWebSocketAdapter } from "./websocket/index.js";
export type {
  BetNgWebSocketAdapter,
  WebSocketAdapter,
  WebSocketAdapterOptions,
  WebSocketReadyState,
  WebSocketSession,
} from "./websocket/index.js";

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
