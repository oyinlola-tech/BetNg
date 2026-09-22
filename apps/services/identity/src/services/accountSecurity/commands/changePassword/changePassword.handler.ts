import { CommandHandler } from "@zudojs/cqrs";
import { AUDIT_ACTION, IDENTITY_COMMAND } from "../../../../constants/index.js";
import { InvalidInputError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { resolveCaller, throttleKey } from "../../../security/index.js";
import { assertAcceptablePassword, customerAuditActor } from "../../accountSecurity.helper.js";
import type { ChangePasswordCommand } from "./changePassword.command.js";

type Dependencies = Pick<
  HandlerDependencies,
  "store" | "resolver" | "hasher" | "throttle" | "audit" | "evictor" | "messenger" | "breachChecker"
>;

/** Keeps the session that made the change and revokes every other one. */
export class ChangePasswordHandler extends CommandHandler<ChangePasswordCommand> {
  public readonly commandType = IDENTITY_COMMAND.CHANGE_PASSWORD;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: ChangePasswordCommand): Promise<void> {
    const { store, resolver, hasher, throttle, audit, evictor, messenger } = this.deps;
    const { customer, session } = await resolveCaller(resolver, store, command.caller, { requireSession: true });
    const key = throttleKey.reauthenticate(customer.id);

    await throttle.assertNotLocked(key);

    if (!(await hasher.verify(command.request.currentPassword, customer.passwordHash))) {
      await throttle.recordFailure(key);
      throw new InvalidInputError("currentPassword", "That password is not right.");
    }

    await throttle.clear(key);
    await assertAcceptablePassword(this.deps, store, customer, command.request.newPassword);

    const passwordHash = await hasher.hash(command.request.newPassword);
    const now = new Date();

    await store.transaction(async (repositories) => {
      await repositories.passwords.change(customer, passwordHash, now);
      await repositories.sessions.revokeOthers(customer.id, session?.id, now);
      await audit.write(repositories, {
        ...customerAuditActor(customer, command.caller.requestId),
        action: AUDIT_ACTION.PASSWORD_CHANGED,
        severity: "NOTICE",
      });
    });

    await evictor.flush();
    void messenger.securityAlert(customer.id, { kind: "PASSWORD_CHANGED" });
  }
}
