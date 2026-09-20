/**
 * Betting domain errors.
 */

import { DomainError } from "@zudojs/errors";
import { ErrorCodes } from "@betng/contracts";

/** Raised when a bet identifier matches nothing. */
export class BetNotFoundError extends DomainError {
  public readonly betId: string;

  public constructor(betId: string) {
    super(`No bet with id ${betId}.`, {
      code: ErrorCodes.NOT_FOUND,
      statusCode: 404,
      metadata: { betId },
    });

    this.name = "BetNotFoundError";
    this.betId = betId;
  }
}

/**
 * Raised when risk declines a slip.
 *
 * A 409 rather than a 422: the slip is well formed, it conflicts with the
 * book's current position. The platform declines the bet; it never accepts
 * one and then arranges for it to lose.
 */
export class MarketSuspendedError extends DomainError {
  public constructor(reason: string) {
    super(reason, {
      code: ErrorCodes.CONFLICT,
      statusCode: 409,
    });

    this.name = "MarketSuspendedError";
  }
}
