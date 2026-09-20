/**
 * The error a BetNG REST call rejects with.
 *
 * Every service answers a failure with the same envelope, so a client has
 * one error shape to handle no matter which service produced it — and the
 * `requestId` is what a developer quotes when asking why a request failed.
 */

import type { ErrorDetail, ErrorResponse } from "@betng/contracts";

export class BetNgApiError extends Error {
  readonly status: number;

  /** The platform's machine-readable code, e.g. `VALIDATION_FAILED`. */
  readonly code: string;

  /** The correlation identifier, for tracing this failure in the logs. */
  readonly requestId: string;

  /** Field-level detail, present only for a validation failure. */
  readonly details: readonly ErrorDetail[];

  constructor(status: number, body: ErrorResponse["error"]) {
    super(body.message);
    this.name = "BetNgApiError";
    this.status = status;
    this.code = body.code;
    this.requestId = body.requestId;
    this.details = body.details ?? [];
  }
}

/** Whether a response body is the platform's error envelope. */
export function isErrorResponse(value: unknown): value is ErrorResponse {
  if (typeof value !== "object" || value === null) return false;

  const error = (value as ErrorResponse).error;

  return (
    typeof error === "object" &&
    error !== null &&
    typeof error.code === "string" &&
    typeof error.message === "string"
  );
}
