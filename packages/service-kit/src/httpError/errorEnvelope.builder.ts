import { ErrorCodes } from "@betng/contracts";
import type { ErrorDetail, ErrorResponse } from "@betng/contracts";
import type { ValidationIssue } from "@zudojs/validation";

export interface ErrorBodyOptions {
  readonly code: string;
  readonly message: string;
  readonly requestId: string;
  readonly details?: readonly ErrorDetail[];
}

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

export function toErrorDetails(
  issues: readonly ValidationIssue[],
): readonly ErrorDetail[] {
  return issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

export const OPAQUE_ERROR_MESSAGE = "An unexpected error occurred.";

export const FALLBACK_ERROR_CODE = ErrorCodes.INTERNAL_ERROR;
