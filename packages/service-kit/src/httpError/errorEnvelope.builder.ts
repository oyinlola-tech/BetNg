/**
 * Construction of the BetNG error envelope.
 */

import { ErrorCodes } from "@betng/contracts";
import type { ErrorDetail, ErrorResponse } from "@betng/contracts";
import type { ValidationIssue } from "@zudojs/validation";

/** What an error envelope is built from. */
export interface ErrorBodyOptions {
  readonly code: string;
  readonly message: string;
  readonly requestId: string;
  readonly details?: readonly ErrorDetail[];
}

/**
 * Builds the envelope every BetNG failure is rendered as.
 *
 * @param options - The code, message, correlation identifier and detail.
 * @returns The response body.
 */
export function buildErrorBody(options: ErrorBodyOptions): ErrorResponse {
  return {
    error: {
      code: options.code,
      message: options.message,
      requestId: options.requestId,
      ...(options.details === undefined ? {} : { details: options.details }),
    },
  };
}

/**
 * Turns `@zudojs/validation` issues into the envelope's `details`.
 *
 * @param issues - The issues a failed validation produced.
 * @returns One detail per issue, keyed by dotted field path.
 */
export function toErrorDetails(
  issues: readonly ValidationIssue[],
): readonly ErrorDetail[] {
  return issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

/** The message sent when nothing may be revealed about a failure. */
export const OPAQUE_ERROR_MESSAGE = "An unexpected error occurred.";

/** The code used when an error carries none of its own. */
export const FALLBACK_ERROR_CODE = ErrorCodes.INTERNAL_ERROR;
