import { Command } from "@zudojs/cqrs";
import type { SelfExcludeRequest } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { CustomerCaller } from "../../../security/index.js";

export class SelfExcludeCommand extends Command<"identity.selfExclude"> {
  public readonly caller: CustomerCaller;

  public readonly request: SelfExcludeRequest;

  public constructor(caller: CustomerCaller, request: SelfExcludeRequest) {
    super(IDENTITY_COMMAND.SELF_EXCLUDE);
    this.caller = caller;
    this.request = request;
  }
}
