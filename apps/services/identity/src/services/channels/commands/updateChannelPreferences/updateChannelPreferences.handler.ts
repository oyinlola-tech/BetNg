import { CommandHandler } from "@zudojs/cqrs";
import type { ChannelPreferences } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import { InvalidInputError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { LOCKED_CHANNELS, resolveChannels } from "../../../../utils/index.js";
import { resolveCaller } from "../../../security/index.js";
import type { UpdateChannelPreferencesCommand } from "./updateChannelPreferences.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "resolver">;

/** A locked entry (security mail) switched off is refused, not silently switched back on. */
export class UpdateChannelPreferencesHandler extends CommandHandler<UpdateChannelPreferencesCommand, ChannelPreferences> {
  public readonly commandType = IDENTITY_COMMAND.UPDATE_CHANNEL_PREFERENCES;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: UpdateChannelPreferencesCommand): Promise<ChannelPreferences> {
    const { store, resolver } = this.deps;
    const { customer } = await resolveCaller(resolver, store, command.caller);

    for (const entry of LOCKED_CHANNELS) {
      const [channel, topic] = entry.split(".") as [keyof ChannelPreferences["channels"], string];

      if ((command.channels[channel] as Record<string, boolean>)[topic] === false) {
        throw new InvalidInputError(`channels.${entry}`, "Security emails cannot be switched off.");
      }
    }

    const channels = resolveChannels(command.channels);

    await store.channels.savePreferences(customer.id, channels, new Date());

    return { channels, locked: [...LOCKED_CHANNELS] };
  }
}
