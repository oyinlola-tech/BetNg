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
