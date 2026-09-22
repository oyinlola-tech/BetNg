import { CommandHandler } from "@zudojs/cqrs";
import type { TwoFactorStatus } from "@betng/contracts";
import { AUDIT_ACTION, IDENTITY_COMMAND } from "../../../../constants/index.js";
import { ConflictError, InvalidInputError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { resolveCaller, throttleKey, verifySecondFactor } from "../../../security/index.js";
import { codeRejected, customerAuditActor, RejectedCode, toTwoFactorStatus } from "../../accountSecurity.helper.js";
import type { DisableTwoFactorCommand } from "./disableTwoFactor.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "resolver" | "hasher" | "throttle" | "protector" | "audit" | "messenger">;

export class DisableTwoFactorHandler extends CommandHandler<DisableTwoFactorCommand, TwoFactorStatus> {
  public readonly commandType = IDENTITY_COMMAND.DISABLE_TWO_FACTOR;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: DisableTwoFactorCommand): Promise<TwoFactorStatus> {
    const { store, resolver, hasher, throttle, protector, audit, messenger } = this.deps;
    const { customer } = await resolveCaller(resolver, store, command.caller);

    if ((await store.twoFactor.find(customer.id)) === undefined) {
      throw new ConflictError("Two-factor authentication is not on.");
    }

    const key = throttleKey.secondFactor(customer.id);

    await throttle.assertNotLocked(key);

    if (!(await hasher.verify(command.request.password, customer.passwordHash))) {
      await throttle.recordFailure(key);
      throw new InvalidInputError("password", "That password is not right.");
    }

    try {
      await store.transaction(async (repositories) => {
        if ((await verifySecondFactor(repositories, protector, customer.id, command.request.code)) === undefined) {
          throw new RejectedCode();
        }

        await repositories.twoFactor.remove(customer.id);
        await audit.write(repositories, {
          ...customerAuditActor(customer, command.caller.requestId),
          action: AUDIT_ACTION.TWO_FACTOR_DISABLED,
          severity: "NOTICE",
        });
      });
    } catch (error) {
      if (error instanceof RejectedCode) {
        await throttle.recordFailure(key);
        throw codeRejected();
      }

      throw error;
    }

    await throttle.clear(key);
    void messenger.securityAlert(customer.id, { kind: "TWO_FACTOR_DISABLED" });

    return toTwoFactorStatus(undefined, 0);
  }
}
