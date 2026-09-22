import { DomainError } from "@zudojs/errors";
import { ErrorCodes } from "@betng/contracts";

export class SettlementNotFoundError extends DomainError {
  public readonly betId: string;

  public constructor(betId: string) {
    super(`Bet ${betId} has not been settled.`, {
      code: ErrorCodes.NOT_FOUND,
      statusCode: 404,
      expose: true,
      metadata: { betId },
    });

    this.name = "SettlementNotFoundError";
    this.betId = betId;
  }
}

export class MatchNotFoundError extends DomainError {
  public constructor(matchId: string) {
    super(`Match ${matchId} does not exist.`, {
      code: ErrorCodes.NOT_FOUND,
      statusCode: 404,
      expose: true,
      metadata: { matchId },
    });

    this.name = "MatchNotFoundError";
  }
}

export class SettlementConflictError extends DomainError {
  public constructor(message: string, metadata: Readonly<Record<string, string>> = {}) {
    super(message, {
      code: ErrorCodes.CONFLICT,
      statusCode: 409,
      expose: true,
      metadata,
    });

    this.name = "SettlementConflictError";
  }
}

/** The message is client-safe; upstream and SQL detail stays on `cause` for the log. */
export class SettlementFailedError extends DomainError {
  public constructor(matchId: string, message: string, cause?: unknown) {
    super(message, {
      code: ErrorCodes.SETTLEMENT_FAILED,
      statusCode: 502,
      expose: true,
      metadata: { matchId },
      ...(cause === undefined ? {} : { cause }),
    });

    this.name = "SettlementFailedError";
  }
}

export class AuditUnavailableError extends DomainError {
  public constructor(cause?: unknown) {
    super("The change was not applied because its audit entry could not be written.", {
      code: ErrorCodes.UPSTREAM_UNAVAILABLE,
      statusCode: 503,
      expose: true,
      ...(cause === undefined ? {} : { cause }),
    });

    this.name = "AuditUnavailableError";
  }
}

/** Stored data settlement cannot use. Retrying cannot help; an operator must look. */
export class SettlementDataError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "SettlementDataError";
  }
}

// Code or data faults repeat on every retry, so they are parked for an operator instead of looping.
export function isPermanentFailure(error: unknown): boolean {
  return (
    error instanceof SettlementDataError ||
    error instanceof TypeError ||
    error instanceof RangeError ||
    error instanceof ReferenceError ||
    error instanceof SyntaxError
  );
}
