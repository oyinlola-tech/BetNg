import { CommandHandler } from "@zudojs/cqrs";
import type { AdminSession } from "@betng/contracts";
import { AUDIT_ACTION, AUDIT_ENTITY, IDENTITY_COMMAND } from "../../../../constants/index.js";
import { toAdminUser } from "../../../../dtos/index.js";
import {
  AccountSuspendedError,
  ConflictError,
  InvalidCredentialsError,
  InvalidInputError,
} from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { normaliseEmail, verifyTotp } from "../../../../utils/index.js";
import { adminTotpContext } from "../../../adminAuth/index.js";
import { throttleKey } from "../../../security/index.js";
import type { ActivateAdminCommand } from "./activateAdmin.command.js";

type Dependencies = Pick<
  HandlerDependencies,
  "store" | "hasher" | "sessions" | "throttle" | "audit" | "protector" | "breachChecker"
>;

const EXPIRED =
  "Those credentials have expired. Ask a super administrator to issue new ones.";

/**
 * Step two, and the only way an administrator issued a one-time password can sign in. It proves the
 * password and a code from the authenticator staged by step one, takes a chosen password in the same call,
 * and only then issues a session — so a one-time password can never become a lasting one.
 */
export class ActivateAdminHandler extends CommandHandler<ActivateAdminCommand, AdminSession> {
  public readonly commandType = IDENTITY_COMMAND.ACTIVATE_ADMIN;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: ActivateAdminCommand): Promise<AdminSession> {
    const { store, hasher, sessions, throttle, audit, protector } = this.deps;
    const { temporaryPassword, newPassword, code } = command.request;
    const email = normaliseEmail(command.request.email);
    const key = throttleKey.admin(email);

    await throttle.assertNotLocked(key);

    // Checked before any lookup, so the time taken does not say whether the address is an administrator.
    if (await this.deps.breachChecker.isBreached(newPassword)) {
      throw new InvalidInputError("newPassword", "That password has appeared in a breach. Choose another.");
    }

    const admin = await store.admins.findByEmail(email);

    if (admin === undefined) {
      await hasher.verifyAgainstNothing(temporaryPassword);
    }

    if (admin === undefined || !(await hasher.verify(temporaryPassword, admin.passwordHash))) {
      await throttle.recordFailure(key);
      throw new InvalidCredentialsError();
    }

    if (admin.status !== "ACTIVE") {
      throw new AccountSuspendedError();
    }

    if (!admin.mustChangePassword) {
      throw new ConflictError("This account is already active. Sign in as usual.");
    }

    if (admin.credentialsExpireAt !== null && admin.credentialsExpireAt.getTime() <= Date.now()) {
      throw new InvalidInputError("temporaryPassword", EXPIRED);
    }

    if (temporaryPassword === newPassword) {
      throw new InvalidInputError("newPassword", "Choose a password different from the one you were issued.");
    }

    if (admin.totpSecret === null) {
      throw new ConflictError("Start activation first: this account has no authenticator to check against.");
    }

    const step = verifyTotp({
      secretBase32: admin.totpSecret.startsWith("v1.")
        ? protector.decrypt(admin.totpSecret, adminTotpContext(admin.id))
        : admin.totpSecret,
      code,
      atMs: Date.now(),
      lastUsedStep: admin.totpLastStep === null ? undefined : Number(admin.totpLastStep),
    });

    if (step === undefined) {
      await throttle.recordFailure(key);
      throw new InvalidInputError("code", "That code is not correct. Check your authenticator and try again.");
    }

    const passwordHash = await hasher.hash(newPassword);

    const session = await store.transaction(async (repositories) => {
      // The same guard the ordinary sign-in uses: one code opens one session.
      if (!(await repositories.admins.claimTotpStep(admin.id, step))) {
        return undefined;
      }

      // One write: the chosen password, and the staged secret becoming the live one now a code from it
      // has been proven. It leaves `totpLastStep` alone, so this code cannot also open a sign-in.
      await repositories.admins.completeActivation(admin.id, passwordHash);

      const signedIn = await repositories.admins.recordLogin(admin.id, new Date());
      const issued = await sessions.issue(repositories, "ADMIN", admin.id);

      await audit.write(repositories, {
        actorId: admin.id,
        actorRole: admin.role,
        actorName: admin.name,
        action: AUDIT_ACTION.ADMIN_ACTIVATED,
        entityType: AUDIT_ENTITY.ADMIN_USER,
        entityId: admin.id,
        severity: "NOTICE",
        requestId: command.requestId,
      });

      return {
        token: issued.token,
        expiresAt: issued.session.expiresAt.toISOString(),
        admin: toAdminUser(signedIn),
      };
    });

    if (session === undefined) {
      await throttle.recordFailure(key);
      throw new InvalidInputError("code", "That code has already been used. Wait for the next one.");
    }

    await throttle.clear(key);

    return session;
  }
}
