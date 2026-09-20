/**
 * Event domain errors.
 */

import { DomainError } from "@zudojs/errors";
import { ErrorCodes } from "@betng/contracts";

/** Raised when a client asks for a channel the service does not serve. */
export class UnknownChannelError extends DomainError {
  public readonly channel: string;

  public constructor(channel: string) {
    super(
      `"${channel}" is not a channel this service serves. Subscribe to ` +
        `match:{matchId}.`,
      {
        code: ErrorCodes.NOT_FOUND,
        statusCode: 404,
        metadata: { channel },
      },
    );

    this.name = "UnknownChannelError";
    this.channel = channel;
  }
}

/** Raised when a client sends a frame the protocol does not define. */
export class InvalidClientFrameError extends DomainError {
  public constructor(reason: string) {
    super(`The frame was rejected: ${reason}`, {
      code: ErrorCodes.VALIDATION_FAILED,
      statusCode: 422,
    });

    this.name = "InvalidClientFrameError";
  }
}
