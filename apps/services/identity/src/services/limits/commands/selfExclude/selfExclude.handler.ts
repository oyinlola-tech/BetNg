import { CommandHandler } from "@zudojs/cqrs";
import type { SelfExclusion } from "@betng/contracts";
import { AUDIT_ACTION, IDENTITY_COMMAND } from "../../../../constants/index.js";
import { toSelfExclusion } from "../../../../dtos/index.js";
import { ConflictError, InvalidInputError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { resolveCaller, throttleKey } from "../../../security/index.js";
import { customerAuditActor } from "../../../accountSecurity/accountSecurity.helper.js";
import { PERIOD_MS } from "../../limits.helper.js";
import type { SelfExcludeCommand } from "./selfExclude.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "resolver" | "hasher" | "throttle" | "audit">;

/**
 * Takes effect immediately: `limits.check` refuses deposits and bets from this moment. The session is kept so the customer
 * can still withdraw and see their account. It cannot be shortened or cancelled before it ends; a longer one may replace it.
 */
export class SelfExcludeHandler extends CommandHandler<SelfExcludeCommand, SelfExclusion> {
  public readonly commandType = IDENTITY_COMMAND.SELF_EXCLUDE;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: SelfExcludeCommand): Promise<SelfExclusion> {
    const { store, resolver, hasher, throttle, audit } = this.deps;
    const { customer } = await resolveCaller(resolver, store, command.caller);
    const key = throttleKey.reauthenticate(customer.id);

    await throttle.assertNotLocked(key);

    if (!(await hasher.verify(command.request.password, customer.passwordHash))) {
      await throttle.recordFailure(key);
      throw new InvalidInputError("password", "That password is not right.");
    }

    await throttle.clear(key);

    const now = new Date();
    const length = PERIOD_MS[command.request.period];
    const endsAt = length === undefined ? undefined : new Date(now.getTime() + length);
    const current = await store.limits.activeExclusion(customer.id, now);

    if (current !== undefined && (current.endsAt === null || (endsAt !== undefined && endsAt <= current.endsAt))) {
      throw new ConflictError("You are already self-excluded for at least that long.");
    }

    const exclusion = await store.transaction(async (repositories) => {
      const created = await repositories.limits.createExclusion({
        customerId: customer.id,
        period: command.request.period,
        startedAt: now,
        endsAt,
        canCancelAt: endsAt,
      });

      await repositories.limits.appendHistory({ customerId: customer.id, kind: "self_exclude", action: "EXCLUDED", previousValue: undefined, value: undefined, at: now });
      await audit.write(repositories, {
        ...customerAuditActor(customer, command.caller.requestId),
        action: AUDIT_ACTION.SELF_EXCLUDED,
        after: { period: command.request.period, endsAt },
        severity: "NOTICE",
      });

      return created;
    });

    return toSelfExclusion(exclusion);
  }
}
