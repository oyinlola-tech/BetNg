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

export const REQUEST_ID_HEADER = "x-request-id";

export const API_PREFIX = "/api/v1";

export const CURRENCY = "NGN" as const;

export type Currency = typeof CURRENCY;

/**
 * The error codes BetNG services return in `error.code`.
 *
 * Part of the public contract: clients branch on them, so the list is added
 * to rather than renamed.
 */
export const ErrorCodes = Object.freeze({
  VALIDATION_FAILED: "VALIDATION_FAILED",
  NOT_FOUND: "NOT_FOUND",
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
  CONFLICT: "CONFLICT",
  UPSTREAM_UNAVAILABLE: "UPSTREAM_UNAVAILABLE",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
});

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export function matchChannel(matchId: string): string {
  return `match:${matchId}`;
}

export const MATCH_CHANNEL_PATTERN = /^match:([0-9a-fA-F-]{36})$/;
