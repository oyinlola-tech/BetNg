import { DomainError } from "@zudojs/errors";
import { ErrorCodes } from "@betng/contracts";

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

export class InvalidClientFrameError extends DomainError {
  public constructor(reason: string) {
    super(`The frame was rejected: ${reason}`, {
      code: ErrorCodes.VALIDATION_FAILED,
      statusCode: 422,
    });

    this.name = "InvalidClientFrameError";
  }
}
