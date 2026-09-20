import { DataSourceError } from "@betng/ui-core";

export interface ErrorPresentation {
  readonly title: string;
  readonly message: string;
  readonly retryable: boolean;
}

export function presentError(error: unknown): ErrorPresentation {
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
