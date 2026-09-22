import { setTimeout as delay } from "node:timers/promises";
import { CommandHandler } from "@zudojs/cqrs";
import { ACCOUNT_SECURITY, AUDIT_ACTION, IDENTITY_COMMAND, SECURITY } from "../../../../constants/index.js";
import { InvalidInputError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { constantTimeEqual, normaliseEmail, verificationCodeHash } from "../../../../utils/index.js";
import { throttleKey } from "../../../security/index.js";
import { assertAcceptablePassword, customerAuditActor } from "../../accountSecurity.helper.js";
import type { ResetPasswordCommand } from "./resetPassword.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "hasher" | "throttle" | "audit" | "evictor" | "messenger" | "breachChecker">;

const rejected = (): InvalidInputError =>
  new InvalidInputError("code", "That code is not right or has expired. Check it, or request a new one.");

/**
 * The same refusal, after the same minimum time, whether the address, the code, its expiry or its guess cap is the problem,
 * so the answer never says whether an account (or a pending reset) exists. The address also has a lockout. A successful
 * reset revokes every session of the account.
 */
export class ResetPasswordHandler extends CommandHandler<ResetPasswordCommand> {
  public readonly commandType = IDENTITY_COMMAND.RESET_PASSWORD;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: ResetPasswordCommand): Promise<void> {
    const floor = delay(SECURITY.PASSWORD_RESET_RESPONSE_MS);

    try {
      await this.reset(command);
    } catch (error) {
      await floor;
      throw error;
    }
  }

  private async reset(command: ResetPasswordCommand): Promise<void> {
    const { store, hasher, throttle, audit, evictor, messenger } = this.deps;
    const email = normaliseEmail(command.request.email);
    const key = throttleKey.passwordReset(email);
    const now = new Date();

    await throttle.assertNotLocked(key);

    const customer = await store.customers.findByEmail(email);
    const reset = customer === undefined ? undefined : await store.passwords.findLatestReset(customer.id);

    if (customer === undefined || reset === undefined || reset.consumedAt !== null || reset.expiresAt <= now || customer.status !== "ACTIVE") {
      await throttle.recordFailure(key);
      throw rejected();
    }

    if (!(await store.passwords.claimResetAttempt(reset.id, ACCOUNT_SECURITY.MAX_PASSWORD_RESET_ATTEMPTS))) {
      await throttle.recordFailure(key);
      throw rejected();
    }

    if (!constantTimeEqual(verificationCodeHash(reset.id, command.request.code), reset.tokenHash)) {
      await throttle.recordFailure(key);
      throw rejected();
    }

    await assertAcceptablePassword(this.deps, store, customer, command.request.newPassword);

    const passwordHash = await hasher.hash(command.request.newPassword);

    await store.transaction(async (repositories) => {
      if (!(await repositories.passwords.consumeReset(reset.id, now))) {
        throw rejected();
      }

      await repositories.passwords.change(customer, passwordHash, now);
      await repositories.sessions.revokeOthers(customer.id, undefined, now);
      await audit.write(repositories, {
        ...customerAuditActor(customer, command.requestId),
        action: AUDIT_ACTION.PASSWORD_RESET,
        severity: "NOTICE",
      });
    });

    await Promise.all([throttle.clear(key), throttle.clear(throttleKey.customer(email)), evictor.flush()]);
    void messenger.securityAlert(customer.id, { kind: "PASSWORD_RESET" });
  }
}
