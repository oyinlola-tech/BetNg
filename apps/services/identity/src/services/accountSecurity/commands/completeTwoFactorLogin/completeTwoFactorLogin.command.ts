import { Command } from "@zudojs/cqrs";
import type { TwoFactorChallengeRequest } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";

export class CompleteTwoFactorLoginCommand extends Command<"identity.completeTwoFactorLogin"> {
  public readonly request: TwoFactorChallengeRequest;

  public readonly userAgent: string | undefined;

  public readonly requestId: string;

  public constructor(request: TwoFactorChallengeRequest, userAgent: string | undefined, requestId: string) {
    super(IDENTITY_COMMAND.COMPLETE_TWO_FACTOR_LOGIN);
    this.request = request;
    this.userAgent = userAgent;
    this.requestId = requestId;
  }
}
