import { randomBytes } from "node:crypto";
import { CommandHandler } from "@zudojs/cqrs";
import type { AdminActivationSecret } from "@betng/contracts";
import { ACCOUNT_SECURITY, IDENTITY_COMMAND } from "../../../../constants/index.js";
import {
  AccountSuspendedError,
  ConflictError,
  InvalidCredentialsError,
  InvalidInputError,
} from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { encodeBase32, normaliseEmail, otpauthUri } from "../../../../utils/index.js";
import { adminTotpContext } from "../../../adminAuth/index.js";
import { throttleKey } from "../../../security/index.js";
import type { StartAdminActivationCommand } from "./startAdminActivation.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "hasher" | "throttle" | "protector">;

/**
 * Issues the authenticator secret to the administrator themselves, over the connection they activate on.
 * Nobody else ever sees it: not the super administrator who created the account, not a log, not a backup
 * of one. Two-factor stays off until a code from it is proven in the second step, so a secret handed out
 * and never enrolled leaves the account exactly as it was.
 */
export class StartAdminActivationHandler extends CommandHandler<StartAdminActivationCommand, AdminActivationSecret> {
  public readonly commandType = IDENTITY_COMMAND.START_ADMIN_ACTIVATION;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: StartAdminActivationCommand): Promise<AdminActivationSecret> {
    const { store, hasher, throttle, protector } = this.deps;
    const { temporaryPassword } = command.request;
    const email = normaliseEmail(command.request.email);
    const key = throttleKey.admin(email);

    await throttle.assertNotLocked(key);

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
      throw new InvalidInputError(
        "temporaryPassword",
        "Those credentials have expired. Ask a super administrator to issue new ones.",
      );
    }

    // A fresh secret each time this is called, so a half-finished attempt cannot be resumed by someone
    // who saw the first one. Stored sealed, with two-factor still off.
    const secret = encodeBase32(randomBytes(ACCOUNT_SECURITY.TOTP_SECRET_BYTES));

    await store.admins.stagePendingTotp(admin.id, protector.encrypt(secret, adminTotpContext(admin.id)));

    return {
      otpauthUri: otpauthUri(admin.email, secret),
      manualKey: (secret.match(/.{1,4}/gu) ?? []).join(" "),
      expiresAt: (admin.credentialsExpireAt ?? new Date(Date.now() + ACCOUNT_SECURITY.TOTP_SECRET_BYTES)).toISOString(),
    };
  }
}
