import { DomainError } from "@zudojs/errors";
import { ErrorCodes } from "@betng/contracts";

/** Also the answer for an id that may never own a wallet (an admin), so the two cannot be told apart. */
export class WalletOwnerNotFoundError extends DomainError {
  public constructor() {
    super("No wallet exists for that owner.", {
      code: ErrorCodes.NOT_FOUND,
      statusCode: 404,
    });

    this.name = "WalletOwnerNotFoundError";
  }
}

export class InsufficientFundsError extends DomainError {
  public readonly available: number;

  public readonly requested: number;

  public constructor(available: number, requested: number) {
    super("The wallet does not hold enough to cover this amount.", {
      code: ErrorCodes.INSUFFICIENT_FUNDS,
      statusCode: 422,
      metadata: { available, requested },
    });

    this.name = "InsufficientFundsError";
    this.available = available;
    this.requested = requested;
  }
}

export class WalletFrozenError extends DomainError {
  public constructor() {
    super("This wallet is frozen and cannot move funds.", {
      code: ErrorCodes.CONFLICT,
      statusCode: 409,
    });

    this.name = "WalletFrozenError";
  }
}

export class IdempotencyConflictError extends DomainError {
  public constructor() {
    super("That idempotency key was already used for a different entry.", {
      code: ErrorCodes.CONFLICT,
      statusCode: 409,
    });

    this.name = "IdempotencyConflictError";
  }
}

export class BalanceLimitError extends DomainError {
  public constructor() {
    super("This wallet cannot hold more than the platform maximum.", {
      code: ErrorCodes.CONFLICT,
      statusCode: 409,
    });

    this.name = "BalanceLimitError";
  }
}

/** The cause is logged by the repository and never returned to a client. */
export class WalletDatabaseError extends DomainError {
  public constructor(cause: unknown) {
    super("The wallet database is unavailable.", {
      code: ErrorCodes.DATABASE_UNAVAILABLE,
      statusCode: 503,
      cause,
    });

    this.name = "WalletDatabaseError";
  }
}
