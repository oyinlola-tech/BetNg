import { Command } from "@zudojs/cqrs";
import type { ChannelPreferences } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { CustomerCaller } from "../../../security/index.js";

export class UpdateChannelPreferencesCommand extends Command<"identity.updateChannelPreferences"> {
  public readonly caller: CustomerCaller;

  public readonly channels: ChannelPreferences["channels"];

  public constructor(caller: CustomerCaller, channels: ChannelPreferences["channels"]) {
    super(IDENTITY_COMMAND.UPDATE_CHANNEL_PREFERENCES);
    this.caller = caller;
    this.channels = channels;
  }
}
