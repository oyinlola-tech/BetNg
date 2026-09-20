import { DomainError } from "@zudojs/errors";
import { ErrorCodes } from "@betng/contracts";

export class SettlementNotFoundError extends DomainError {
  public readonly betId: string;

  public constructor(betId: string) {
    super(`Bet ${betId} has not been settled.`, {
      code: ErrorCodes.NOT_FOUND,
      statusCode: 404,
      metadata: { betId },
    });

    this.name = "SettlementNotFoundError";
    this.betId = betId;
  }
}
