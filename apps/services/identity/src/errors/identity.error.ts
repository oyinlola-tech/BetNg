// No message says which part of a credential was wrong or whether an account exists.

import { DomainError } from "@zudojs/errors";
import { ErrorCodes } from "@betng/contracts";

export class InvalidCredentialsError extends DomainError {
  public constructor() {
    super("Those details do not match an account.", {
      code: ErrorCodes.INVALID_CREDENTIALS,
      statusCode: 401,
    });
    this.name = "InvalidCredentialsError";
  }
}

export class UnauthenticatedError extends DomainError {
  public constructor() {
    super("Sign in to continue.", { code: ErrorCodes.UNAUTHENTICATED, statusCode: 401 });
    this.name = "UnauthenticatedError";
  }
}

export class SessionExpiredError extends DomainError {
  public constructor() {
    super("Your session has ended. Sign in again to continue.", {
      code: ErrorCodes.SESSION_EXPIRED,
      statusCode: 401,
    });
    this.name = "SessionExpiredError";
  }
}

export class AccountSuspendedError extends DomainError {
  public constructor(message = "This account has been suspended.") {
    super(message, { code: ErrorCodes.FORBIDDEN, statusCode: 403 });
    this.name = "AccountSuspendedError";
  }
}

export class EmailNotVerifiedError extends DomainError {
  public constructor() {
    super("This email has not been verified yet.", {
      code: ErrorCodes.CONFLICT,
      statusCode: 409,
    });
    this.name = "EmailNotVerifiedError";
  }
}

export class TooManyAttemptsError extends DomainError {
  public constructor(message = "Too many attempts. Wait a while before trying again.") {
    super(message, { code: ErrorCodes.RATE_LIMITED, statusCode: 429 });
    this.name = "TooManyAttemptsError";
  }
}

export class ConflictError extends DomainError {
  public constructor(message: string) {
    super(message, { code: ErrorCodes.CONFLICT, statusCode: 409 });
    this.name = "ConflictError";
  }
}

export class ResourceNotFoundError extends DomainError {
  public constructor(message: string) {
    super(message, { code: ErrorCodes.NOT_FOUND, statusCode: 404 });
    this.name = "ResourceNotFoundError";
  }
}

export class InvalidInputError extends DomainError {
  public readonly details: readonly { readonly path: string; readonly message: string }[];

  public constructor(field: string, message: string) {
    super(message, { code: ErrorCodes.VALIDATION_FAILED, statusCode: 422 });
    this.name = "InvalidInputError";
    this.details = [{ path: field, message }];
  }
}
