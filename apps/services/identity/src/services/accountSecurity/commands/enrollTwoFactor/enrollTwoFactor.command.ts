import { Command } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { CustomerCaller } from "../../../security/index.js";

export class EnrollTwoFactorCommand extends Command<"identity.enrollTwoFactor"> {
  public readonly caller: CustomerCaller;

  public constructor(caller: CustomerCaller) {
    super(IDENTITY_COMMAND.ENROLL_TWO_FACTOR);
    this.caller = caller;
  }
}
