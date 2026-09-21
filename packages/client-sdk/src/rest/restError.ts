import type { ErrorDetail, ErrorResponse } from "@betng/contracts";

export class BetNgApiError extends Error {
  readonly status: number;

  readonly code: string;

  readonly requestId: string;

  readonly details: readonly ErrorDetail[];
  /** Context of a domain error, e.g. `maxStake` on STAKE_LIMITED or `current` on ODDS_CHANGED. */
  readonly data: Readonly<Record<string, unknown>>;

  constructor(status: number, body: ErrorResponse["error"]) {
    super(body.message);
    this.name = "BetNgApiError";
    this.status = status;
    this.code = body.code;
    this.requestId = body.requestId;
    this.details = body.details ?? [];
    this.data = body.data ?? {};
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
