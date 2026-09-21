import { CommandHandler } from "@zudojs/cqrs";
import type { AdminSession } from "@betng/contracts";
import {
  AUDIT_ACTION,
  AUDIT_ENTITY,
  IDENTITY_COMMAND,
  UNKNOWN_ACTOR,
} from "../../../../constants/index.js";
import { toAdminUser } from "../../../../dtos/index.js";
import {
  AccountSuspendedError,
  InvalidCredentialsError,
  InvalidInputError,
} from "../../../../errors/index.js";
import type { AdminUser } from "../../../../generated/prisma/client.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { normaliseEmail, verifyTotp } from "../../../../utils/index.js";
import { throttleKey } from "../../../security/index.js";
import type { LoginAdminCommand } from "./loginAdmin.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "hasher" | "sessions" | "throttle" | "audit">;

type FailureCause = "credentials" | "two_factor_code" | "suspended";

const CODE_REQUIRED =
  "This account uses two-factor authentication. Enter the six-digit code from your authenticator.";
const CODE_REJECTED = "That code is not correct. Check your authenticator and try again.";

/** Reads `admin_users` only. The admin app moves to its code step on a 422 `VALIDATION_FAILED`, sent only after the password is proven. */
export class LoginAdminHandler extends CommandHandler<LoginAdminCommand, AdminSession> {
  public readonly commandType = IDENTITY_COMMAND.LOGIN_ADMIN;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: LoginAdminCommand): Promise<AdminSession> {
    const { store, hasher, sessions, throttle, audit } = this.deps;
    const { password, code } = command.request;
    const email = normaliseEmail(command.request.email);
    const key = throttleKey.admin(email);

    await throttle.assertNotLocked(key);

    const admin = await store.admins.findByEmail(email);

    if (admin === undefined) {
      await hasher.verifyAgainstNothing(password);
    }

    if (admin === undefined || !(await hasher.verify(password, admin.passwordHash))) {
      await throttle.recordFailure(key);
      await this.auditFailure(command, email, admin, "credentials");
      throw new InvalidCredentialsError();
    }

    if (admin.status !== "ACTIVE") {
      await this.auditFailure(command, email, admin, "suspended");
      throw new AccountSuspendedError();
    }

    let step: number | undefined;

    if (admin.twoFactorEnabled) {
      if (code === undefined) {
        throw new InvalidInputError("code", CODE_REQUIRED);
      }

      step =
        admin.totpSecret === null
          ? undefined
          : verifyTotp({
              secretBase32: admin.totpSecret,
              code,
              atMs: Date.now(),
              lastUsedStep: admin.totpLastStep === null ? undefined : Number(admin.totpLastStep),
            });

      if (step === undefined) {
        await this.rejectCode(command, email, admin, key);
      }
    }

    const claimedStep = step;

    const session = await store.transaction(async (repositories) => {
      // Conditional on the step still being newer, so one code cannot open two sessions.
      if (claimedStep !== undefined && !(await repositories.admins.claimTotpStep(admin.id, claimedStep))) {
        return undefined;
      }

      const signedIn = await repositories.admins.recordLogin(admin.id, new Date());
      const issued = await sessions.issue(repositories, "ADMIN", admin.id);

      await audit.write(repositories, {
        actorId: admin.id,
        actorRole: admin.role,
        actorName: admin.name,
        action: AUDIT_ACTION.ADMIN_LOGIN,
        entityType: AUDIT_ENTITY.ADMIN_USER,
        entityId: admin.id,
        requestId: command.requestId,
      });

      return {
        token: issued.token,
        expiresAt: issued.session.expiresAt.toISOString(),
        admin: toAdminUser(signedIn),
      };
    });

    if (session === undefined) {
      return this.rejectCode(command, email, admin, key);
    }

    await throttle.clear(key);

    return session;
  }

  private async rejectCode(
    command: LoginAdminCommand,
    email: string,
    admin: AdminUser,
    key: string,
  ): Promise<never> {
    await this.deps.throttle.recordFailure(key);
    await this.auditFailure(command, email, admin, "two_factor_code");
    throw new InvalidInputError("code", CODE_REJECTED);
  }

  private async auditFailure(
    command: LoginAdminCommand,
    email: string,
    admin: AdminUser | undefined,
    cause: FailureCause,
  ): Promise<void> {
    await this.deps.audit.write(this.deps.store, {
      actorId: admin?.id ?? UNKNOWN_ACTOR.id,
      actorRole: admin?.role ?? UNKNOWN_ACTOR.role,
      actorName: admin?.name ?? UNKNOWN_ACTOR.name,
      action: AUDIT_ACTION.ADMIN_LOGIN_FAILED,
      entityType: AUDIT_ENTITY.ADMIN_USER,
      entityId: admin?.id ?? UNKNOWN_ACTOR.id,
      after: { email, cause },
      severity: "WARNING",
      requestId: command.requestId,
    });
  }
}
