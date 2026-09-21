import { CommandHandler } from "@zudojs/cqrs";
import type { PlatformSettings } from "@betng/contracts";
import { AUDIT_ACTION, AUDIT_ENTITY, IDENTITY_COMMAND } from "../../../../constants/index.js";
import {
  ConflictError,
  InvalidInputError,
  ResourceNotFoundError,
} from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import type { UpdateSettingsCommand } from "./updateSettings.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "audit">;

export class UpdateSettingsHandler extends CommandHandler<UpdateSettingsCommand, PlatformSettings> {
  public readonly commandType = IDENTITY_COMMAND.UPDATE_SETTINGS;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: UpdateSettingsCommand): Promise<PlatformSettings> {
    const { store, audit } = this.deps;
    const { actor, changes, reason } = command;

    return store.transaction(async (repositories) => {
      const stored = await repositories.settings.find();

      if (stored === undefined) {
        throw new ResourceNotFoundError("Platform settings have not been initialised.");
      }

      const next: PlatformSettings = { ...stored.value, ...changes };

      if (next.minStake >= next.maxStake) {
        throw new InvalidInputError("minStake", "Minimum stake must be below maximum stake.");
      }

      const changedKeys = (Object.keys(changes) as (keyof PlatformSettings)[]).filter(
        (key) => changes[key] !== undefined && changes[key] !== stored.value[key],
      );

      if (changedKeys.length === 0) {
        return stored.value;
      }

      // Versioned write: a concurrent change makes this one fail rather than silently overwrite it.
      if (!(await repositories.settings.replace(stored.version, next, actor.id, new Date()))) {
        throw new ConflictError("The settings were changed by someone else. Reload and try again.");
      }

      await audit.write(repositories, {
        actorId: actor.id,
        actorRole: actor.role,
        actorName: actor.name,
        action: AUDIT_ACTION.SETTINGS_CHANGED,
        entityType: AUDIT_ENTITY.SETTINGS,
        entityId: "platform",
        before: {
          version: stored.version,
          ...Object.fromEntries(changedKeys.map((key) => [key, stored.value[key]])),
        },
        after: {
          version: stored.version + 1,
          ...Object.fromEntries(changedKeys.map((key) => [key, next[key]])),
        },
        reason,
        severity: "CRITICAL",
        requestId: actor.requestId,
      });

      return next;
    });
  }
}
