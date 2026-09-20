import { DomainError } from "@zudojs/errors";
import { ErrorCodes } from "@betng/contracts";

export class WalletNotFoundError extends DomainError {
  public readonly userId: string;

  public constructor(userId: string) {
    super(`No wallet for user ${userId}.`, {
      code: ErrorCodes.NOT_FOUND,
      statusCode: 404,
      metadata: { userId },
    });

    this.name = "WalletNotFoundError";
    this.userId = userId;
  }
}

/**
 * Raised when a debit would take a simulated balance below zero.
 *
 * A 409 rather than a 422: the request is well formed, it just conflicts
 * with the wallet's current state.
 */
export class InsufficientFundsError extends DomainError {
  public readonly available: number;

  public readonly requested: number;

  public constructor(available: number, requested: number) {
    super(
      `The wallet holds ${String(available)} but ${String(requested)} was ` +
        `requested.`,
      {
        code: ErrorCodes.CONFLICT,
        statusCode: 409,
        metadata: { available, requested },
      },
    );

    this.name = "InsufficientFundsError";
    this.available = available;
    this.requested = requested;
  }
}
