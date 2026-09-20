/**
 * Match domain errors.
 *
 * They extend `DomainError` from `@zudojs/errors` rather than `Error`, so
 * each one already carries the status code, the machine-readable code and
 * the `expose` flag the service kit's error handler renders. A handler
 * raises one of these and the HTTP layer needs no knowledge of the domain.
 */

import { DomainError } from "@zudojs/errors";
import { ErrorCodes } from "@betng/contracts";

export class MatchNotFoundError extends DomainError {
  public readonly matchId: string;

  public constructor(matchId: string) {
    super(`No match with id ${matchId}.`, {
      code: ErrorCodes.NOT_FOUND,
      statusCode: 404,
      metadata: { matchId },
    });

    this.name = "MatchNotFoundError";
    this.matchId = matchId;
  }
}
