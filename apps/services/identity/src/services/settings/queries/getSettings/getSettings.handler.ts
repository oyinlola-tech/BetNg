import { QueryHandler } from "@zudojs/cqrs";
import type { PlatformSettings } from "@betng/contracts";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import { ResourceNotFoundError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import type { GetSettingsQuery } from "./getSettings.query.js";

type Dependencies = Pick<HandlerDependencies, "store">;

export class GetSettingsHandler extends QueryHandler<GetSettingsQuery, PlatformSettings> {
  public readonly queryType = IDENTITY_QUERY.GET_SETTINGS;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(): Promise<PlatformSettings> {
    const stored = await this.deps.store.settings.find();

    if (stored === undefined) {
      throw new ResourceNotFoundError("Platform settings have not been initialised.");
    }

    return stored.value;
  }
}
