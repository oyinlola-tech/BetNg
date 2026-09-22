export {
  buildErrorBody,
  FALLBACK_ERROR_CODE,
  OPAQUE_ERROR_MESSAGE,
  toErrorDetails,
} from "./errorEnvelope.builder.js";
export type { ErrorBodyOptions } from "./errorEnvelope.builder.js";

export {
  isErrorDetails,
  unwrapStatusError,
} from "./errorEnvelope.resolver.js";
export type { StatusCarrying } from "./errorEnvelope.resolver.js";

export { createErrorHandler, describeError, stacksAllowed } from "./errorEnvelope.handler.js";
export type { ErrorHandlerOptions, ServiceErrorHandler } from "./errorEnvelope.handler.js";
