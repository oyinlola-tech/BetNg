/**
 * The error codes BetNG services return in `error.code`.
 *
 * Codes are part of the public contract: clients branch on them, so the list
 * is added to rather than renamed. Choosing the HTTP status stays with the
 * service; this list only fixes the vocabulary.
 */

export const ErrorCodes = Object.freeze({
  /** The request body or query failed schema validation. */
  VALIDATION_FAILED: "VALIDATION_FAILED",
  /** The requested resource does not exist. */
  NOT_FOUND: "NOT_FOUND",
  /** The route exists, but not for this method. */
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
  /** The request is well-formed but conflicts with current state. */
  CONFLICT: "CONFLICT",
  /** A downstream BetNG service could not be reached or timed out. */
  UPSTREAM_UNAVAILABLE: "UPSTREAM_UNAVAILABLE",
  /** The service is running but a dependency it needs is not ready. */
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  /** An unexpected failure. The message is never derived from the cause. */
  INTERNAL_ERROR: "INTERNAL_ERROR",
});

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
