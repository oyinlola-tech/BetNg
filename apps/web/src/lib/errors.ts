/**
 * Maps API error codes to user-friendly messages.
 * Used for displaying contextual error messages in the UI.
 */

export interface ErrorMessage {
  title: string;
  description: string;
  action?: string;
  helpLink?: string;
}

const ERROR_MESSAGES: Record<string, ErrorMessage> = {
  // Authentication errors
  AUTH_INVALID_CREDENTIALS: {
    title: "Invalid credentials",
    description: "The email or password you entered is incorrect. Please try again.",
    action: "Retry",
  },
  AUTH_EMAIL_NOT_VERIFIED: {
    title: "Email not verified",
    description: "Please check your inbox and verify your email address before signing in.",
    action: "Resend verification email",
  },
  AUTH_ACCOUNT_SUSPENDED: {
    title: "Account suspended",
    description: "Your account has been suspended. Please contact support for assistance.",
    helpLink: "/support",
  },
  AUTH_TOKEN_EXPIRED: {
    title: "Session expired",
    description: "Your session has expired. Please sign in again.",
    action: "Sign in",
  },
  AUTH_2FA_REQUIRED: {
    title: "Two-factor authentication required",
    description: "Please enter your two-factor authentication code.",
  },
  AUTH_2FA_INVALID: {
    title: "Invalid code",
    description: "The two-factor authentication code is incorrect. Please try again.",
  },

  // Betting errors
  BET_MARKET_CLOSED: {
    title: "Market closed",
    description: "This market is no longer accepting bets.",
  },
  BET_INSUFFICIENT_BALANCE: {
    title: "Insufficient balance",
    description: "You don't have enough balance to place this bet.",
    action: "Deposit funds",
  },
  BET_STAKE_EXCEEDS_LIMIT: {
    title: "Stake exceeds limit",
    description: "Your stake exceeds the maximum allowed for this market.",
  },
  BET_ODDS_CHANGED: {
    title: "Odds have changed",
    description: "The odds have changed since you selected them. Please review and try again.",
    action: "Refresh odds",
  },
  BET_DUPLICATE: {
    title: "Duplicate bet",
    description: "You have already placed this exact bet.",
  },
  BET_RISK_REJECTED: {
    title: "Bet rejected",
    description: "This bet was rejected by our risk system. Please try a different stake or selection.",
  },

  // Payment errors
  PAYMENT_FAILED: {
    title: "Payment failed",
    description: "Your payment could not be processed. Please try again or use a different method.",
    action: "Retry payment",
  },
  PAYMENT_DECLINED: {
    title: "Payment declined",
    description: "Your card was declined. Please check your card details or try a different card.",
  },
  PAYMENT_INSUFFICIENT_FUNDS: {
    title: "Insufficient funds",
    description: "Your card doesn't have enough funds for this transaction.",
  },
  PAYMENT_NETWORK_ERROR: {
    title: "Network error",
    description: "We couldn't connect to the payment provider. Please try again.",
    action: "Retry",
  },
  PAYMENT_WEBHOOK_PENDING: {
    title: "Processing payment",
    description: "Your payment is being processed. This may take a few minutes.",
  },

  // Withdrawal errors
  WITHDRAWAL_MINIMUM: {
    title: "Below minimum",
    description: "The withdrawal amount is below the minimum allowed.",
  },
  WITHDRAWAL_MAXIMUM: {
    title: "Exceeds maximum",
    description: "The withdrawal amount exceeds the maximum allowed.",
  },
  WITHDRAWAL_NO_BANK_ACCOUNT: {
    title: "No bank account",
    description: "Please add a bank account before requesting a withdrawal.",
    action: "Add bank account",
  },
  WITHDRAWAL_PENDING: {
    title: "Withdrawal in progress",
    description: "You already have a pending withdrawal. Please wait for it to complete.",
  },

  // KYC errors
  KYC_DOCUMENT_REQUIRED: {
    title: "Document required",
    description: "Please upload a valid government-issued ID to verify your identity.",
    action: "Upload document",
  },
  KYC_DOCUMENT_INVALID: {
    title: "Document rejected",
    description: "The document you uploaded could not be verified. Please try a different document.",
  },
  KYC_VERIFICATION_PENDING: {
    title: "Verification pending",
    description: "Your documents are being reviewed. This usually takes 1-2 business days.",
  },

  // Limit errors
  LIMIT_DEPOSIT_EXCEEDED: {
    title: "Deposit limit reached",
    description: "You've reached your deposit limit for this period.",
    helpLink: "/responsible-gaming",
  },
  LIMIT_LOSS_EXCEEDED: {
    title: "Loss limit reached",
    description: "You've reached your loss limit for this period.",
    helpLink: "/responsible-gaming",
  },
  LIMIT_SELF_EXCLUDED: {
    title: "Self-exclusion active",
    description: "Your self-exclusion is currently active. You cannot place bets during this period.",
    helpLink: "/responsible-gaming",
  },

  // Generic errors
  VALIDATION_FAILED: {
    title: "Invalid input",
    description: "Please check your input and try again.",
  },
  NOT_FOUND: {
    title: "Not found",
    description: "The resource you're looking for doesn't exist or has been removed.",
  },
  INTERNAL_ERROR: {
    title: "Something went wrong",
    description: "An unexpected error occurred. Please try again or contact support if the problem persists.",
    action: "Retry",
    helpLink: "/support",
  },
  SERVICE_UNAVAILABLE: {
    title: "Service unavailable",
    description: "Our service is temporarily unavailable. Please try again in a few minutes.",
    action: "Retry",
  },
  RATE_LIMITED: {
    title: "Too many requests",
    description: "You're making too many requests. Please wait a moment before trying again.",
  },
  NETWORK_ERROR: {
    title: "Connection error",
    description: "We couldn't connect to the server. Please check your internet connection.",
    action: "Retry",
  },
};

/**
 * Get a user-friendly error message for an API error code.
 */
export function getErrorMessage(code: string): ErrorMessage {
  return (
    ERROR_MESSAGES[code] ?? {
      title: "Error",
      description: "An unexpected error occurred. Please try again.",
      action: "Retry",
    }
  );
}

/**
 * Get error message from an HTTP response status code.
 */
export function getErrorFromStatus(status: number): ErrorMessage {
  switch (status) {
    case 400:
      return getErrorMessage("VALIDATION_FAILED");
    case 401:
      return getErrorMessage("AUTH_TOKEN_EXPIRED");
    case 403:
      return getErrorMessage("AUTH_ACCOUNT_SUSPENDED");
    case 404:
      return getErrorMessage("NOT_FOUND");
    case 429:
      return getErrorMessage("RATE_LIMITED");
    case 503:
      return getErrorMessage("SERVICE_UNAVAILABLE");
    default:
      return getErrorMessage("INTERNAL_ERROR");
  }
}
