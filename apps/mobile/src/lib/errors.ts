import { DataSourceError } from "@betng/ui-core";

export function presentError(error: unknown): {
  readonly title: string;
  readonly message: string;
  readonly retryable: boolean;
} {
  if (error instanceof DataSourceError) {
    switch (error.code) {
      case "NOT_FOUND":
        return {
          title: "Not available",
          message: error.message,
          retryable: false,
        };
      case "NETWORK":
        return {
          title: "Connection problem",
          message: "Check your connection and try again.",
          retryable: true,
        };
      case "BETTING_CLOSED":
        return {
          title: "Betting closed",
          message: error.message,
          retryable: false,
        };
      case "INSUFFICIENT_FUNDS":
        return {
          title: "Insufficient balance",
          message: error.message,
          retryable: false,
        };
      case "VALIDATION":
        return {
          title: "Check the details",
          message: error.message,
          retryable: false,
        };
      case "INVALID_CREDENTIALS":
        return { title: "Sign-in failed", message: "Those details do not match an account. Check them and try again.", retryable: false };
      case "UNAUTHENTICATED":
        return { title: "Sign in required", message: "Sign in to continue.", retryable: false };
      case "SESSION_EXPIRED":
        return { title: "Session ended", message: "Sign in again to pick up where you left off.", retryable: false };
      case "FORBIDDEN":
        return { title: "Permission denied", message: "Your role does not allow this action.", retryable: false };
      case "CONFLICT":
        return { title: "Already changed", message: error.message, retryable: false };
      case "RATE_LIMITED":
        return { title: "Too many attempts", message: "Wait a moment before trying again.", retryable: true };
      case "SERVER":
        return {
          title: "Something went wrong",
          message: "The platform could not complete that. Try again shortly.",
          retryable: true,
        };
    }
  }

  return {
    title: "Something went wrong",
    message: "An unexpected error occurred.",
    retryable: true,
  };
}
