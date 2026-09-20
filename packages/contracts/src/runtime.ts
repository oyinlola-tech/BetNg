/**
 * The framework-free half of the contracts.
 *
 * Everything here is a plain value: no zod, no `@zudojs/*`, nothing that
 * touches Node. That matters because a browser or React Native client needs
 * these constants but must not pull a validation library and `node:crypto`
 * into its bundle to get them.
 *
 * The package's main entry re-exports these, so a service importing from
 * `@betng/contracts` still sees one definition of each. A client imports
 * `@betng/contracts/runtime` instead and gets the same values without the
 * server-side machinery.
 */

/** The header that carries the correlation identifier between services. */
export const REQUEST_ID_HEADER = "x-request-id";

/** The API version prefix every public route sits behind. */
export const API_PREFIX = "/api/v1";

/** The single currency this platform uses. */
export const CURRENCY = "NGN" as const;

export type Currency = typeof CURRENCY;

/**
 * The error codes BetNG services return in `error.code`.
 *
 * Part of the public contract: clients branch on them, so the list is added
 * to rather than renamed.
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
  /** The route and its contract exist; the capability behind it does not. */
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
  /** An unexpected failure. The message is never derived from the cause. */
  INTERNAL_ERROR: "INTERNAL_ERROR",
});

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/** The channel a client subscribes to for one match's live events. */
export function matchChannel(matchId: string): string {
  return `match:${matchId}`;
}

/** Matches a channel name and captures the match identifier. */
export const MATCH_CHANNEL_PATTERN = /^match:([0-9a-fA-F-]{36})$/;
