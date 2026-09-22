import { Command } from "@zudojs/cqrs";
import type { LimitKind } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { CustomerCaller } from "../../../security/index.js";

export class RemoveLimitCommand extends Command<"identity.removeLimit"> {
  public readonly caller: CustomerCaller;

  public readonly kind: LimitKind;

  public constructor(caller: CustomerCaller, kind: LimitKind) {
    super(IDENTITY_COMMAND.REMOVE_LIMIT);
    this.caller = caller;
    this.kind = kind;
  }
}
