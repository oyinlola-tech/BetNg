import { BetNgApiError } from "@betng/client-sdk";
import {
  DataSourceError,
  type DataSourceErrorCode,
  type DataSourceErrorDetail,
} from "../dataSource.type.js";

function detail(cause: BetNgApiError): DataSourceErrorDetail {
  const fields: Record<string, string> = {};

  for (const item of cause.details) {
    if (!(item.path in fields)) fields[item.path] = item.message;
  }

  return {
    status: cause.status,
    requestId: cause.requestId,
    ...(Object.keys(fields).length === 0 ? {} : { fields }),
    ...(cause.retryAfterSeconds === undefined ? {} : { retryAfterSeconds: cause.retryAfterSeconds }),
  };
}

const BY_CODE: Readonly<Partial<Record<string, DataSourceErrorCode>>> = {
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  RATE_LIMITED: "RATE_LIMITED",
  VALIDATION_FAILED: "VALIDATION",
  INVALID_BET: "VALIDATION",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  MARKET_CLOSED: "BETTING_CLOSED",
  ODDS_CHANGED: "ODDS_CHANGED",
  STAKE_LIMITED: "STAKE_LIMITED",
  RISK_REJECTED: "BET_REJECTED",
  INSUFFICIENT_FUNDS: "INSUFFICIENT_FUNDS",
  CONFLICT: "CONFLICT",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
  LIMIT_EXCEEDED: "LIMIT_EXCEEDED",
  SELF_EXCLUDED: "SELF_EXCLUDED",
  KYC_REQUIRED: "KYC_REQUIRED",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  PAYMENT_PROVIDER_UNAVAILABLE: "UNAVAILABLE",
  ODDS_UNAVAILABLE: "UNAVAILABLE",
  RISK_UNAVAILABLE: "UNAVAILABLE",
  DATABASE_UNAVAILABLE: "UNAVAILABLE",
  UPSTREAM_UNAVAILABLE: "UNAVAILABLE",
  SERVICE_UNAVAILABLE: "UNAVAILABLE",
};

const BY_STATUS: Readonly<Partial<Record<number, DataSourceErrorCode>>> = {
  400: "VALIDATION",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "VALIDATION",
  429: "RATE_LIMITED",
  501: "NOT_IMPLEMENTED",
  502: "UNAVAILABLE",
  503: "UNAVAILABLE",
  504: "TIMEOUT",
};

/** Translates the SDK's error into the one screens branch on. A 401 without a session is a failed login; with one, the session has ended. */
export function translateApiError(cause: unknown, hasSession = false): DataSourceError {
  if (cause instanceof DataSourceError) return cause;

  if (cause instanceof BetNgApiError) {
    const info = detail(cause);

    if (cause.kind === "offline") return new DataSourceError("OFFLINE", cause.message, info);
    if (cause.kind === "timeout") return new DataSourceError("TIMEOUT", cause.message, info);
    if (cause.status === 0) return new DataSourceError("NETWORK", cause.message, info);
    if (cause.kind === "parse") return new DataSourceError("SERVER", "The platform sent an answer that could not be read.", info);

    if (cause.status === 401 || cause.code === "UNAUTHENTICATED" || cause.code === "SESSION_EXPIRED") {
      return hasSession || cause.code === "SESSION_EXPIRED"
        ? new DataSourceError("SESSION_EXPIRED", "Your session has ended. Sign in again to continue.", info)
        : new DataSourceError("INVALID_CREDENTIALS", cause.message, info);
    }

    const code = BY_CODE[cause.code] ?? BY_STATUS[cause.status] ?? "SERVER";

    // A 5xx message can carry internals; the screen shows its own wording for these codes.
    const message = code === "SERVER" || code === "UNAVAILABLE" ? "The platform could not complete the request." : cause.message;

    return new DataSourceError(code, message, info);
  }

  return new DataSourceError("SERVER", "Something went wrong.");
}
