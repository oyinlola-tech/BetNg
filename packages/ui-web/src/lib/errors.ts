import { DataSourceError } from "@betng/ui-core";
import type { DataSourceErrorCode } from "@betng/ui-core";

export type ErrorTone = "danger" | "warning" | "info";

export interface ErrorPresentation {
  readonly title: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly tone: ErrorTone;
  readonly code?: DataSourceErrorCode;
  readonly requestId?: string;
}

interface ErrorPreset {
  readonly title: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly tone: ErrorTone;
  /** The platform's own sentence is written for the customer and replaces the default. */
  readonly platformMessage?: boolean;
}

const MAX_PLATFORM_MESSAGE = 240;

const PRESETS: Record<DataSourceErrorCode, ErrorPreset> = {
  NOT_FOUND: {
    title: "Not available",
    message: "This is no longer available. It may have been moved or removed.",
    retryable: false,
    tone: "info",
    platformMessage: true,
  },
  NETWORK: {
    title: "Connection problem",
    message: "Check your connection and try again.",
    retryable: true,
    tone: "warning",
  },
  OFFLINE: {
    title: "You are offline",
    message: "Reconnect to the internet and try again.",
    retryable: true,
    tone: "warning",
  },
  TIMEOUT: {
    title: "That took too long",
    message: "The request timed out. Try again.",
    retryable: true,
    tone: "warning",
  },
  SERVER: {
    title: "Something went wrong",
    message: "The platform could not complete that. Try again shortly.",
    retryable: true,
    tone: "danger",
  },
  UNAVAILABLE: {
    title: "Temporarily unavailable",
    message: "This service is not responding right now. Try again in a moment.",
    retryable: true,
    tone: "warning",
  },
  NOT_IMPLEMENTED: {
    title: "Not available yet",
    message: "This feature is not available on the platform yet.",
    retryable: false,
    tone: "info",
  },
  BETTING_CLOSED: {
    title: "Betting closed",
    message: "Betting has closed for this match.",
    retryable: false,
    tone: "warning",
    platformMessage: true,
  },
  MARKET_SUSPENDED: {
    title: "Market suspended",
    message: "This market is suspended. It reopens when trading resumes.",
    retryable: true,
    tone: "warning",
    platformMessage: true,
  },
  ODDS_CHANGED: {
    title: "Odds changed",
    message: "The price moved before your bet was accepted. Review the new odds.",
    retryable: true,
    tone: "warning",
    platformMessage: true,
  },
  STAKE_LIMITED: {
    title: "Stake limited",
    message: "That stake is outside the limit for this bet. Adjust it and try again.",
    retryable: false,
    tone: "warning",
    platformMessage: true,
  },
  BET_REJECTED: {
    title: "Bet not accepted",
    message: "The platform did not accept this bet.",
    retryable: false,
    tone: "danger",
    platformMessage: true,
  },
  INSUFFICIENT_FUNDS: {
    title: "Insufficient balance",
    message: "Your balance does not cover this amount.",
    retryable: false,
    tone: "warning",
    platformMessage: true,
  },
  VALIDATION: {
    title: "Check the details",
    message: "Some details are missing or not valid.",
    retryable: false,
    tone: "warning",
    platformMessage: true,
  },
  INVALID_CREDENTIALS: {
    title: "Sign-in failed",
    message: "Those details do not match an account. Check them and try again.",
    retryable: false,
    tone: "danger",
  },
  UNAUTHENTICATED: {
    title: "Sign in required",
    message: "Sign in to continue.",
    retryable: false,
    tone: "info",
  },
  SESSION_EXPIRED: {
    title: "Session ended",
    message: "Sign in again to pick up where you left off.",
    retryable: false,
    tone: "info",
  },
  FORBIDDEN: {
    title: "Permission denied",
    message: "Your role does not allow this action.",
    retryable: false,
    tone: "danger",
  },
  CONFLICT: {
    title: "Already changed",
    message: "This was changed somewhere else. Refresh and try again.",
    retryable: false,
    tone: "warning",
    platformMessage: true,
  },
  RATE_LIMITED: {
    title: "Too many attempts",
    message: "Wait a moment before trying again.",
    retryable: true,
    tone: "warning",
  },
};

const UNKNOWN: ErrorPresentation = {
  title: "Something went wrong",
  message: "An unexpected error occurred. Try again.",
  retryable: true,
  tone: "danger",
};

function waitWording(seconds: number): string {
  const rounded = Math.ceil(seconds);

  if (rounded < 60)
    return `Wait ${String(rounded)} second${rounded === 1 ? "" : "s"} before trying again.`;

  const minutes = Math.ceil(rounded / 60);

  return `Wait about ${String(minutes)} minute${minutes === 1 ? "" : "s"} before trying again.`;
}

function messageFor(error: DataSourceError, preset: ErrorPreset): string {
  const retryAfter = error.detail.retryAfterSeconds;

  if (
    error.code === "RATE_LIMITED" &&
    retryAfter !== undefined &&
    Number.isFinite(retryAfter) &&
    retryAfter > 0
  )
    return waitWording(retryAfter);

  if (preset.platformMessage !== true) return preset.message;

  const text = error.message.trim();

  return text.length === 0 || text.length > MAX_PLATFORM_MESSAGE
    ? preset.message
    : text;
}

export function presentError(error: unknown): ErrorPresentation {
  if (!(error instanceof DataSourceError)) return UNKNOWN;

  const preset = PRESETS[error.code] as ErrorPreset | undefined;

  if (preset === undefined) return UNKNOWN;

  const requestId = error.detail.requestId;

  return {
    title: preset.title,
    message: messageFor(error, preset),
    retryable: preset.retryable,
    tone: preset.tone,
    code: error.code,
    ...(requestId === undefined || requestId === "" ? {} : { requestId }),
  };
}
