import { BetNgApiError } from "@betng/client-sdk";
import { DataSourceError } from "../dataSource.type.js";

/** Translates the SDK's error into the one screens branch on. A 401 without a session is a failed login; with one, the session has ended. */
export function translateApiError(cause: unknown, hasSession = false): DataSourceError {
  if (cause instanceof DataSourceError) return cause;

  if (cause instanceof BetNgApiError) {
    if (cause.status === 0) return new DataSourceError("NETWORK", cause.message);
    if (cause.status === 401 || cause.code === "UNAUTHENTICATED" || cause.code === "SESSION_EXPIRED") {
      return hasSession || cause.code === "SESSION_EXPIRED"
        ? new DataSourceError("SESSION_EXPIRED", "Your session has ended. Sign in again to continue.")
        : new DataSourceError("INVALID_CREDENTIALS", cause.message);
    }
    if (cause.status === 403 || cause.code === "FORBIDDEN") return new DataSourceError("FORBIDDEN", cause.message);
    if (cause.status === 404 || cause.code === "NOT_FOUND") return new DataSourceError("NOT_FOUND", cause.message);
    if (cause.status === 429 || cause.code === "RATE_LIMITED") return new DataSourceError("RATE_LIMITED", cause.message);
    if (cause.code === "VALIDATION_FAILED") return new DataSourceError("VALIDATION", cause.message);
    if (cause.status === 409 || cause.code === "CONFLICT") return new DataSourceError("CONFLICT", cause.message);

    return new DataSourceError("SERVER", cause.message);
  }

  return new DataSourceError("SERVER", cause instanceof Error ? cause.message : "Something went wrong.");
}
