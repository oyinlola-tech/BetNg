import type { ErrorDetail, ErrorResponse } from "@betng/contracts";

export type ApiFailureKind =
  "http" | "network" | "timeout" | "offline" | "parse";

export interface ApiFailureMeta {
  readonly kind?: ApiFailureKind;
  readonly retryAfterSeconds?: number | undefined;
}

export class BetNgApiError extends Error {
  readonly status: number;
  readonly kind: ApiFailureKind;
  readonly retryAfterSeconds: number | undefined;

  readonly code: string;

  readonly requestId: string;

  readonly details: readonly ErrorDetail[];
  /** Context of a domain error, e.g. `maxStake` on STAKE_LIMITED or `current` on ODDS_CHANGED. */
  readonly data: Readonly<Record<string, unknown>>;

  constructor(
    status: number,
    body: ErrorResponse["error"],
    meta: ApiFailureMeta = {},
  ) {
    super(body.message);
    this.kind = meta.kind ?? "http";
    this.retryAfterSeconds = meta.retryAfterSeconds;
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

const STATUS_CODES: Readonly<Record<number, string>> = Object.freeze({
  400: "VALIDATION_FAILED",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  405: "METHOD_NOT_ALLOWED",
  409: "CONFLICT",
  422: "VALIDATION_FAILED",
  429: "RATE_LIMITED",
  501: "NOT_IMPLEMENTED",
  502: "UPSTREAM_UNAVAILABLE",
  503: "SERVICE_UNAVAILABLE",
  504: "UPSTREAM_UNAVAILABLE",
});

/** The code for a response that carried no error envelope, such as one from a proxy in front of the gateway. */
export function codeForStatus(status: number): string {
  return STATUS_CODES[status] ?? "INTERNAL_ERROR";
}

export function isRetryableStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}
