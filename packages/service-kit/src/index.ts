/**
 * @betng/service-kit
 *
 * The bootstrap every BetNG TypeScript service is built from.
 *
 * It exists so the five services share one implementation of the things that
 * must not drift between them — configuration loading, log shape, request
 * correlation, the error envelope, health semantics and the outbound client
 * — rather than five copies that slowly diverge. Everything here is a thin
 * arrangement of `@zudojs/*` packages; none of it reimplements the framework.
 *
 * Domain logic belongs in the services, never here.
 */

export * from "./config/index.js";
export * from "./logging/index.js";
export * from "./http/index.js";
export * from "./health/index.js";
export * from "./clients/index.js";
export * from "./runService.js";

// Re-exported so a service depends on one package for its HTTP vocabulary
// and cannot end up with a second copy of @zudojs/http.
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
  type HttpRequestContext,
  type HttpResponseContext,
  type HttpRouter,
  type HttpRouterContext,
} from "@zudojs/http";
