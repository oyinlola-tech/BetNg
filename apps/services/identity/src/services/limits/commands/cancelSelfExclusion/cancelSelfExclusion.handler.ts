import { CommandHandler } from "@zudojs/cqrs";
import type { SelfExclusion } from "@betng/contracts";
import { AUDIT_ACTION, IDENTITY_COMMAND } from "../../../../constants/index.js";
import { toSelfExclusion } from "../../../../dtos/index.js";
import { ConflictError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { resolveCaller } from "../../../security/index.js";
import { customerAuditActor } from "../../../accountSecurity/accountSecurity.helper.js";
import type { CancelSelfExclusionCommand } from "./cancelSelfExclusion.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "resolver" | "audit">;

export class CancelSelfExclusionHandler extends CommandHandler<CancelSelfExclusionCommand, SelfExclusion> {
  public readonly commandType = IDENTITY_COMMAND.CANCEL_SELF_EXCLUSION;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: CancelSelfExclusionCommand): Promise<SelfExclusion> {
    const { store, resolver, audit } = this.deps;
    const { customer } = await resolveCaller(resolver, store, command.caller);
    const now = new Date();
    const active = await store.limits.activeExclusion(customer.id, now);

    if (active === undefined) {
      return toSelfExclusion(undefined);
    }

    if (active.canCancelAt === null || active.canCancelAt > now) {
      throw new ConflictError("A self-exclusion cannot be cancelled before it ends.");
    }

    await store.transaction(async (repositories) => {
      if (await repositories.limits.cancelExclusion(active.id, now)) {
        await audit.write(repositories, { ...customerAuditActor(customer, command.caller.requestId), action: AUDIT_ACTION.SELF_EXCLUSION_CANCELLED });
      }
    });

    return toSelfExclusion(undefined);
  }
}
