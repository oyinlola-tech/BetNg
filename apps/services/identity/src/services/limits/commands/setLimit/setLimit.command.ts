import { Command } from "@zudojs/cqrs";
import type { LimitKind } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { CustomerCaller } from "../../../security/index.js";

export class SetLimitCommand extends Command<"identity.setLimit"> {
  public readonly caller: CustomerCaller;

  public readonly kind: LimitKind;

  public readonly value: number;

  public constructor(caller: CustomerCaller, kind: LimitKind, value: number) {
    super(IDENTITY_COMMAND.SET_LIMIT);
    this.caller = caller;
    this.kind = kind;
    this.value = value;
  }
}
