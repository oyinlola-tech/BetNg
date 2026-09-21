import { CommandHandler } from "@zudojs/cqrs";
import { AUDIT_ACTION, AUDIT_ENTITY, IDENTITY_COMMAND } from "../../../../constants/index.js";
import { UnauthenticatedError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { sha256Hex } from "../../../../utils/index.js";
import type { LogoutCommand } from "./logout.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "audit">;

/** Only a session of the route's own kind is revoked; an already-dead token still answers 204. */
export class LogoutHandler extends CommandHandler<LogoutCommand> {
  public readonly commandType = IDENTITY_COMMAND.LOGOUT;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: LogoutCommand): Promise<void> {
    const { store, audit } = this.deps;

    if (command.token === undefined) {
      throw new UnauthenticatedError();
    }

    const tokenHash = sha256Hex(command.token);

    await store.transaction(async (repositories) => {
      const revoked = await repositories.sessions.revokeByTokenHash(tokenHash, command.kind, new Date());

      if (revoked === undefined || revoked.kind !== "ADMIN") {
        return;
      }

      const admin = await repositories.admins.findById(revoked.subjectId);

      if (admin !== undefined) {
        await audit.write(repositories, {
          actorId: admin.id,
          actorRole: admin.role,
          actorName: admin.name,
          action: AUDIT_ACTION.ADMIN_LOGOUT,
          entityType: AUDIT_ENTITY.ADMIN_USER,
          entityId: admin.id,
          requestId: command.requestId,
        });
      }
    });
  }
}
