import { Command } from "@zudojs/cqrs";
import type { RegisterPushDeviceRequest } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { CustomerCaller } from "../../../security/index.js";

export class RegisterPushDeviceCommand extends Command<"identity.registerPushDevice"> {
  public readonly caller: CustomerCaller;

  public readonly request: RegisterPushDeviceRequest;

  public constructor(caller: CustomerCaller, request: RegisterPushDeviceRequest) {
    super(IDENTITY_COMMAND.REGISTER_PUSH_DEVICE);
    this.caller = caller;
    this.request = request;
  }
}
