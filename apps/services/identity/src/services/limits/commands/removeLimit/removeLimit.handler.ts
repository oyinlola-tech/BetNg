import { CommandHandler } from "@zudojs/cqrs";
import type { LimitsSummary } from "@betng/contracts";
import { AUDIT_ACTION, IDENTITY_COMMAND, RESPONSIBLE_GAMING } from "../../../../constants/index.js";
import { ResourceNotFoundError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { resolveCaller } from "../../../security/index.js";
import { customerAuditActor } from "../../../accountSecurity/accountSecurity.helper.js";
import { buildLimitsSummary } from "../../limits.helper.js";
import type { RemoveLimitCommand } from "./removeLimit.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "resolver" | "audit" | "readModel">;

/** Removing a limit loosens it, so the limit stays in force until the cooling-off period ends. */
export class RemoveLimitHandler extends CommandHandler<RemoveLimitCommand, LimitsSummary> {
  public readonly commandType = IDENTITY_COMMAND.REMOVE_LIMIT;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: RemoveLimitCommand): Promise<LimitsSummary> {
    const { store, resolver, audit } = this.deps;
    const { customer } = await resolveCaller(resolver, store, command.caller);
    const { kind } = command;
    const now = new Date();

    await store.limits.settleDue(customer.id, now);

    const existing = await store.limits.find(customer.id, kind);

    if (existing === undefined) {
      throw new ResourceNotFoundError("There is no such limit on your account.");
    }

    if (existing.removalEffectiveAt === null) {
      await store.transaction(async (repositories) => {
        await repositories.limits.scheduleRemoval(customer.id, kind, new Date(now.getTime() + RESPONSIBLE_GAMING.COOLING_OFF_MS), now);
        await repositories.limits.appendHistory({ customerId: customer.id, kind, action: "REMOVED", previousValue: existing.value, value: undefined, at: now });
        await audit.write(repositories, {
          ...customerAuditActor(customer, command.caller.requestId),
          action: AUDIT_ACTION.LIMIT_CHANGED,
          before: { kind, value: existing.value },
          after: { kind, removed: true },
        });
      });
    }

    return buildLimitsSummary(this.deps, store, customer, now);
  }
}
