import { QueryHandler } from "@zudojs/cqrs";
import type { ChannelPreferences } from "@betng/contracts";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { LOCKED_CHANNELS, resolveChannels } from "../../../../utils/index.js";
import { resolveCaller } from "../../../security/index.js";
import type { GetChannelPreferencesQuery } from "./getChannelPreferences.query.js";

type Dependencies = Pick<HandlerDependencies, "store" | "resolver">;

export class GetChannelPreferencesHandler extends QueryHandler<GetChannelPreferencesQuery, ChannelPreferences> {
  public readonly queryType = IDENTITY_QUERY.GET_CHANNEL_PREFERENCES;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: GetChannelPreferencesQuery): Promise<ChannelPreferences> {
    const { store, resolver } = this.deps;
    const { customer } = await resolveCaller(resolver, store, query.caller);
    const stored = await store.channels.findPreferences(customer.id);

    return { channels: resolveChannels(stored?.channels), locked: [...LOCKED_CHANNELS] };
  }
}
