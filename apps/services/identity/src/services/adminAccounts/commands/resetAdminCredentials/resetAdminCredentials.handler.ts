import { CommandHandler } from "@zudojs/cqrs";
import type { AdminCredentials } from "@betng/contracts";
import {
  AUDIT_ACTION,
  AUDIT_ENTITY,
  IDENTITY_COMMAND,
  SECURITY,
} from "../../../../constants/index.js";
import { ForbiddenError, ResourceNotFoundError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { issueTemporarySecrets } from "../../../../utils/index.js";
import { throttleKey } from "../../../security/index.js";
import type { ResetAdminCredentialsCommand } from "./resetAdminCredentials.command.js";

type Dependencies = Pick<
  HandlerDependencies,
  "store" | "hasher" | "audit" | "evictor" | "throttle" | "messenger" | "logger"
>;

/**
 * Issues a fresh one-time password and clears the authenticator, so the account goes back through
 * activation and enrols a new one of its own. The old password and the old authenticator both stop working
 * at once, and every session is dropped.
 */
export class ResetAdminCredentialsHandler extends CommandHandler<ResetAdminCredentialsCommand, AdminCredentials> {
  public readonly commandType = IDENTITY_COMMAND.RESET_ADMIN_CREDENTIALS;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: ResetAdminCredentialsCommand): Promise<AdminCredentials> {
    const { store, hasher, audit } = this.deps;
    const { actor, adminId } = command;

    if (actor.role !== "SUPER_ADMIN") {
      throw new ForbiddenError("Only a super administrator can reset administrator credentials.");
    }

    const secrets = await issueTemporarySecrets();
    const passwordHash = await hasher.hash(secrets.password);
    const expiresAt = new Date(Date.now() + SECURITY.TEMPORARY_CREDENTIALS_TTL_MS);

    const email = await store.transaction(async (repositories) => {
      const admin = await repositories.admins.findById(adminId);

      if (admin === undefined) {
        throw new ResourceNotFoundError("That administrator does not exist.");
      }

      await repositories.admins.resetCredentials(adminId, passwordHash, expiresAt);

      // Whoever was signed in with the old password is signed out.
      await repositories.sessions.revokeForSubjects("ADMIN", [adminId], new Date());

      await audit.write(repositories, {
        actorId: actor.id,
        actorRole: actor.role,
        actorName: actor.name,
        action: AUDIT_ACTION.ADMIN_CREDENTIALS_RESET,
        entityType: AUDIT_ENTITY.ADMIN_USER,
        entityId: adminId,
        after: { email: admin.email },
        severity: "CRITICAL",
        requestId: actor.requestId,
      });

      return admin.email;
    });

    await this.deps.throttle.clear(throttleKey.admin(email));
    await this.deps.evictor.flush();

    await this.deps.messenger
      .sendTemplate({
        to: email,
        template: "admin_credentials",
        variables: {
          name: email,
          email,
          temporaryPassword: secrets.password,
          expiresInHours: String(Math.round(SECURITY.TEMPORARY_CREDENTIALS_TTL_MS / 3_600_000)),
        },
        idempotencyKey: `admin-reset-${adminId}-${String(expiresAt.getTime())}`,
      })
      .catch(() => {
        this.deps.logger.warn("Reset administrator credentials could not be emailed", {
          event: "admin_credentials_email_failed",
          adminId,
        });
      });

    return { email, temporaryPassword: secrets.password, expiresAt: expiresAt.toISOString() };
  }
}
