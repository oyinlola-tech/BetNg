import type { ErrorDetail, ErrorResponse } from "@betng/contracts";

export class BetNgApiError extends Error {
  readonly status: number;

  readonly code: string;

  readonly requestId: string;

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
