import { Command } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { CustomerCaller } from "../../../security/index.js";

export class RemovePushDeviceCommand extends Command<"identity.removePushDevice"> {
  public readonly caller: CustomerCaller;

  public readonly deviceId: string;

  public constructor(caller: CustomerCaller, deviceId: string) {
    super(IDENTITY_COMMAND.REMOVE_PUSH_DEVICE);
    this.caller = caller;
    this.deviceId = deviceId;
  }
}
