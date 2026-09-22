import { ErrorCodes } from "@betng/contracts";
import type { Ticket } from "@betng/contracts";
import {
  conflict,
  forbidden,
  notFound,
  serviceUnavailable,
  unprocessableEntity,
} from "@betng/service-kit";
import type { HttpError } from "@betng/service-kit";

export interface CurrentPrice {
  readonly selectionId: string;
  readonly odds: number;
  readonly oddsVersion: number;
}

export function invalidBet(message: string): HttpError {
  return unprocessableEntity(message, {
    code: ErrorCodes.INVALID_BET,
    expose: true,
  });
}

export function invalidRequest(message: string): HttpError {
  return unprocessableEntity(message, {
    code: ErrorCodes.VALIDATION_FAILED,
    expose: true,
  });
}

export function marketClosed(
  message: string,
  selectionIds: readonly string[] = [],
): HttpError {
  return conflict(message, {
    code: ErrorCodes.MARKET_CLOSED,
    expose: true,
    ...(selectionIds.length === 0 ? {} : { details: { selectionIds } }),
  });
}

export function oddsChanged(current: readonly CurrentPrice[]): HttpError {
  return conflict("The odds changed. Review the new prices and try again.", {
    code: ErrorCodes.ODDS_CHANGED,
    expose: true,
    details: { current },
  });
}

export function stakeLimited(maxStake: number): HttpError {
  return conflict("The stake is above what can be accepted on this slip.", {
    code: ErrorCodes.STAKE_LIMITED,
    expose: true,
    details: { maxStake },
  });
}

export function riskRejected(message: string): HttpError {
  return conflict(message, { code: ErrorCodes.RISK_REJECTED, expose: true });
}

export function riskUnavailable(): HttpError {
  return serviceUnavailable(
    "Bets cannot be accepted right now. Nothing was charged.",
    { code: ErrorCodes.RISK_UNAVAILABLE, expose: true },
  );
}

export function insufficientFunds(message: string): HttpError {
  return unprocessableEntity(message, {
    code: ErrorCodes.INSUFFICIENT_FUNDS,
    expose: true,
  });
}

export function stakeNotTaken(): HttpError {
  return conflict("The wallet declined the stake. Nothing was charged.", {
    code: ErrorCodes.CONFLICT,
    expose: true,
  });
}

export function upstreamUnavailable(message: string): HttpError {
  return serviceUnavailable(message, {
    code: ErrorCodes.UPSTREAM_UNAVAILABLE,
    expose: true,
  });
}

export function placementUnavailable(): HttpError {
  return serviceUnavailable(
    "The match is busy. Nothing was charged; try again.",
    { code: ErrorCodes.SERVICE_UNAVAILABLE, expose: true },
  );
}

export function actorNotAllowed(message: string): HttpError {
  return forbidden(message, { code: ErrorCodes.FORBIDDEN, expose: true });
}

export function betNotFound(): HttpError {
  return notFound("No such bet.", { code: ErrorCodes.NOT_FOUND, expose: true });
}

export function ticketNotFound(): HttpError {
  return notFound("No such ticket.", {
    code: ErrorCodes.NOT_FOUND,
    expose: true,
  });
}

export function ticketConflict(message: string, ticket: Ticket): HttpError {
  return conflict(message, {
    code: ErrorCodes.CONFLICT,
    expose: true,
    details: { ticket },
  });
}

export function selfExcluded(): HttpError {
  return forbidden("Your account is self-excluded, so bets cannot be placed. Nothing was charged.", {
    code: ErrorCodes.SELF_EXCLUDED,
    expose: true,
  });
}

export function accountRestricted(): HttpError {
  return forbidden("Your account cannot place bets right now. Nothing was charged.", {
    code: ErrorCodes.ACCOUNT_RESTRICTED,
    expose: true,
  });
}

export function limitExceeded(): HttpError {
  return conflict("This bet would go over a responsible-gaming limit you set. Nothing was charged.", {
    code: ErrorCodes.LIMIT_EXCEEDED,
    expose: true,
  });
}

export function limitsUnavailable(): HttpError {
  return serviceUnavailable("Bets cannot be accepted right now. Nothing was charged.", {
    code: ErrorCodes.SERVICE_UNAVAILABLE,
    expose: true,
  });
}
