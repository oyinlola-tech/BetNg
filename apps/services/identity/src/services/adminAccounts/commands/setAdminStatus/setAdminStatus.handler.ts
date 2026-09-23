import { CommandHandler } from "@zudojs/cqrs";
import type { AdminUser } from "@betng/contracts";
import { AUDIT_ACTION, AUDIT_ENTITY, IDENTITY_COMMAND } from "../../../../constants/index.js";
import { toAdminUser } from "../../../../dtos/index.js";
import { ConflictError, ForbiddenError, ResourceNotFoundError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import type { SetAdminStatusCommand } from "./setAdminStatus.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "audit" | "evictor">;

export class SetAdminStatusHandler extends CommandHandler<SetAdminStatusCommand, AdminUser> {
  public readonly commandType = IDENTITY_COMMAND.SET_ADMIN_STATUS;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: SetAdminStatusCommand): Promise<AdminUser> {
    const { store, audit } = this.deps;
    const { actor, adminId, status, reason } = command;

    if (actor.role !== "SUPER_ADMIN") {
      throw new ForbiddenError("Only a super administrator can suspend an administrator.");
    }

    // Suspending yourself would lock you out with no one able to undo it but another super administrator.
    if (actor.id === adminId) {
      throw new ForbiddenError("You cannot change your own status.");
    }

    const updated = await store.transaction(async (repositories) => {
      const admin = await repositories.admins.findById(adminId);

      if (admin === undefined) {
        throw new ResourceNotFoundError("That administrator does not exist.");
      }

      if (
        status === "SUSPENDED" &&
        admin.role === "SUPER_ADMIN" &&
        (await repositories.admins.countOtherActiveSuperAdmins(adminId)) === 0
      ) {
        throw new ConflictError("This is the last active super administrator and cannot be suspended.");
      }

      const row = await repositories.admins.update(adminId, { status });

      if (status === "SUSPENDED") {
        await repositories.sessions.revokeForSubjects("ADMIN", [adminId], new Date());
      }

      await audit.write(repositories, {
        actorId: actor.id,
        actorRole: actor.role,
        actorName: actor.name,
        action: AUDIT_ACTION.ADMIN_STATUS_CHANGED,
        entityType: AUDIT_ENTITY.ADMIN_USER,
        entityId: adminId,
        before: { status: admin.status },
        after: { status },
        reason,
        severity: "CRITICAL",
        requestId: actor.requestId,
      });

      return row;
    });

    await this.deps.evictor.flush();

    return toAdminUser(updated);
  }
}
