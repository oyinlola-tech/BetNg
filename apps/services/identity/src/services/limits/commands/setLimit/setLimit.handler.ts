import { CommandHandler } from "@zudojs/cqrs";
import type { LimitsSummary } from "@betng/contracts";
import { AUDIT_ACTION, IDENTITY_COMMAND, RESPONSIBLE_GAMING } from "../../../../constants/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { resolveCaller } from "../../../security/index.js";
import { customerAuditActor } from "../../../accountSecurity/accountSecurity.helper.js";
import { assertLimitValue, buildLimitsSummary } from "../../limits.helper.js";
import type { SetLimitCommand } from "./setLimit.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "resolver" | "audit" | "readModel">;

/** A new or tighter limit applies at once; a looser one waits out the cooling-off period as a pending value. */
export class SetLimitHandler extends CommandHandler<SetLimitCommand, LimitsSummary> {
  public readonly commandType = IDENTITY_COMMAND.SET_LIMIT;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: SetLimitCommand): Promise<LimitsSummary> {
    const { store, resolver, audit } = this.deps;
    const { customer } = await resolveCaller(resolver, store, command.caller);
    const { kind } = command;

    assertLimitValue(kind, command.value);

    const value = BigInt(command.value);
    const now = new Date();

    await store.limits.settleDue(customer.id, now);

    await store.transaction(async (repositories) => {
      const existing = await repositories.limits.find(customer.id, kind);
      const history = { customerId: customer.id, kind, at: now, value };

      if (existing === undefined) {
        await repositories.limits.set(customer.id, kind, value, now);
        await repositories.limits.appendHistory({ ...history, action: "SET", previousValue: undefined });
      } else if (value < existing.value) {
        await repositories.limits.set(customer.id, kind, value, now);
        await repositories.limits.appendHistory({ ...history, action: "LOWERED", previousValue: existing.value });
      } else if (value === existing.value) {
        await repositories.limits.set(customer.id, kind, value, now);
      } else {
        await repositories.limits.setPending(customer.id, kind, value, new Date(now.getTime() + RESPONSIBLE_GAMING.COOLING_OFF_MS), now);
        await repositories.limits.appendHistory({ ...history, action: "RAISED", previousValue: existing.value });
      }

      await audit.write(repositories, {
        ...customerAuditActor(customer, command.caller.requestId),
        action: AUDIT_ACTION.LIMIT_CHANGED,
        before: existing === undefined ? undefined : { kind, value: existing.value },
        after: { kind, value },
      });
    });

    return buildLimitsSummary(this.deps, store, customer, now);
  }
}
