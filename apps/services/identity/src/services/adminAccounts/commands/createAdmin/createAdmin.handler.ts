import { CommandHandler } from "@zudojs/cqrs";
import { isConflictError } from "@zudojs/database";
import type { AdminCredentials } from "@betng/contracts";
import {
  AUDIT_ACTION,
  AUDIT_ENTITY,
  IDENTITY_COMMAND,
  SECURITY,
} from "../../../../constants/index.js";
import { ConflictError, ForbiddenError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { issueTemporarySecrets, normaliseEmail } from "../../../../utils/index.js";
import type { CreateAdminCommand } from "./createAdmin.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "hasher" | "audit" | "messenger" | "logger">;

/**
 * Only a super administrator reaches this. The one-time password is returned once, here; the authenticator
 * secret is not, and is never seen by the creator — the new administrator is issued their own when they
 * activate, so the account has exactly one holder from the start.
 */
export class CreateAdminHandler extends CommandHandler<CreateAdminCommand, AdminCredentials> {
  public readonly commandType = IDENTITY_COMMAND.CREATE_ADMIN;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: CreateAdminCommand): Promise<AdminCredentials> {
    const { store, hasher, audit } = this.deps;
    const { actor, request } = command;

    // Every administrator permission is handed out by this route, so only a super administrator may use it.
    if (actor.role !== "SUPER_ADMIN") {
      throw new ForbiddenError("Only a super administrator can create an administrator.");
    }

    const email = normaliseEmail(request.email);
    const secrets = await issueTemporarySecrets();
    const passwordHash = await hasher.hash(secrets.password);
    const expiresAt = new Date(Date.now() + SECURITY.TEMPORARY_CREDENTIALS_TTL_MS);

    let adminId: string;

    try {
      adminId = await store.transaction(async (repositories) => {
        const created = await repositories.admins.create({
          email,
          name: request.name.trim(),
          role: request.role,
          passwordHash,
          totpSecret: undefined,
          mustChangePassword: true,
          credentialsExpireAt: expiresAt,
        });

        await audit.write(repositories, {
          actorId: actor.id,
          actorRole: actor.role,
          actorName: actor.name,
          action: AUDIT_ACTION.ADMIN_CREATED,
          entityType: AUDIT_ENTITY.ADMIN_USER,
          entityId: created.id,
          after: { email, name: created.name, role: created.role },
          severity: "CRITICAL",
          requestId: actor.requestId,
        });

        return created.id;
      });
    } catch (error) {
      if (isConflictError(error)) {
        throw new ConflictError("An administrator with that email already exists.");
      }

      throw error;
    }

    // Best effort: the credentials are returned to the caller either way, and the row already exists.
    await this.deps.messenger
      .sendTemplate({
        to: email,
        template: "admin_credentials",
        variables: {
          name: request.name.trim(),
          email,
          temporaryPassword: secrets.password,
          expiresInHours: String(Math.round(SECURITY.TEMPORARY_CREDENTIALS_TTL_MS / 3_600_000)),
        },
        idempotencyKey: `admin-credentials-${adminId}`,
      })
      .catch(() => {
        this.deps.logger.warn("New administrator credentials could not be emailed", {
          event: "admin_credentials_email_failed",
          adminId,
        });
      });

    return { email, temporaryPassword: secrets.password, expiresAt: expiresAt.toISOString() };
  }
}
