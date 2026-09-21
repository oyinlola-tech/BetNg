/**
 * Match domain errors.
 *
 * They extend `DomainError` from `@zudojs/errors` rather than `Error`, so each one already carries the status
 * code, the machine-readable code and the `expose` flag the service kit's error handler renders. Messages are
 * written for a client: they never carry a peer's error text, SQL or a stack.
 */

import { DomainError } from "@zudojs/errors";
import { ErrorCodes } from "@betng/contracts";
import type { ErrorCode } from "@betng/contracts";

export class NotFoundError extends DomainError {
  public constructor(resource: "league" | "team" | "match", id: string) {
    super(`No ${resource} with id ${id}.`, {
      code: ErrorCodes.NOT_FOUND,
      statusCode: 404,
      metadata: { resource },
    });

    this.name = "NotFoundError";
  }
}

export class MatchNotFoundError extends NotFoundError {
  public readonly matchId: string;

  public constructor(matchId: string) {
    super("match", matchId);
    this.name = "MatchNotFoundError";
    this.matchId = matchId;
  }
}

export class StatsNotAvailableError extends DomainError {
  public constructor(matchId: string) {
    super("This match has no statistics yet.", { code: ErrorCodes.NOT_FOUND, statusCode: 404, metadata: { matchId } });
    this.name = "StatsNotAvailableError";
  }
}

/** The request is well formed but cannot apply to the state the resource is in. */
export class MatchConflictError extends DomainError {
  public constructor(message: string) {
    super(message, { code: ErrorCodes.CONFLICT, statusCode: 409 });
    this.name = "MatchConflictError";
  }
}

/** A match that has a committed result can never be simulated again; the only remedy is voiding it. */
export class ResultImmutableError extends DomainError {
  public constructor(matchId: string) {
    super("This match already has a result. A result is immutable; void the match instead.", {
      code: ErrorCodes.RESULT_IMMUTABLE,
      statusCode: 409,
      metadata: { matchId },
    });

    this.name = "ResultImmutableError";
  }
}

export class InvalidRequestError extends DomainError {
  /** Read by the service kit's error handler, which lists the offending fields to the client. */
  public readonly details: readonly { readonly path: string; readonly message: string }[];

  public constructor(message: string, path: string) {
    super(message, { code: ErrorCodes.VALIDATION_FAILED, statusCode: 422 });

    this.name = "InvalidRequestError";
    this.details = [{ path, message }];
  }
}

const PEER_STATUS: Partial<Record<ErrorCode, number>> = {
  [ErrorCodes.ODDS_UNAVAILABLE]: 503,
  [ErrorCodes.UPSTREAM_UNAVAILABLE]: 503,
  [ErrorCodes.SIMULATION_FAILED]: 502,
  [ErrorCodes.SETTLEMENT_FAILED]: 502,
};

/** A peer the operation depends on failed, so the operation did not happen. */
export class PeerFailedError extends DomainError {
  public constructor(code: ErrorCode, message: string) {
    super(message, { code, statusCode: PEER_STATUS[code] ?? 503 });
    this.name = "PeerFailedError";
  }
}
