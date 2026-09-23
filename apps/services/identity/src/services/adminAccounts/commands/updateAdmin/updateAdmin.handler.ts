import { CommandHandler } from "@zudojs/cqrs";
import type { AdminUser } from "@betng/contracts";
import { AUDIT_ACTION, AUDIT_ENTITY, IDENTITY_COMMAND } from "../../../../constants/index.js";
import { toAdminUser } from "../../../../dtos/index.js";
import { ConflictError, ForbiddenError, ResourceNotFoundError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import type { UpdateAdminCommand } from "./updateAdmin.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "audit" | "evictor">;

/**
 * A role change hands out or takes away every permission that role carries, so it is a super
 * administrator's decision, never one an administrator can make about themselves.
 */
export class UpdateAdminHandler extends CommandHandler<UpdateAdminCommand, AdminUser> {
  public readonly commandType = IDENTITY_COMMAND.UPDATE_ADMIN;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: UpdateAdminCommand): Promise<AdminUser> {
    const { store, audit } = this.deps;
    const { actor, adminId, request } = command;

    if (actor.role !== "SUPER_ADMIN") {
      throw new ForbiddenError("Only a super administrator can change an administrator.");
    }

    if (actor.id === adminId && request.role !== undefined) {
      throw new ForbiddenError("You cannot change your own role.");
    }

    const updated = await store.transaction(async (repositories) => {
      const admin = await repositories.admins.findById(adminId);

      if (admin === undefined) {
        throw new ResourceNotFoundError("That administrator does not exist.");
      }

      // The database refuses this too; refusing here gives the caller a message they can act on.
      if (
        request.role !== undefined &&
        admin.role === "SUPER_ADMIN" &&
        request.role !== "SUPER_ADMIN" &&
        (await repositories.admins.countOtherActiveSuperAdmins(adminId)) === 0
      ) {
        throw new ConflictError("This is the last active super administrator; promote another one first.");
      }

      const row = await repositories.admins.update(adminId, {
        ...(request.name === undefined ? {} : { name: request.name.trim() }),
        ...(request.role === undefined ? {} : { role: request.role }),
      });

      await audit.write(repositories, {
        actorId: actor.id,
        actorRole: actor.role,
        actorName: actor.name,
        action: AUDIT_ACTION.ADMIN_UPDATED,
        entityType: AUDIT_ENTITY.ADMIN_USER,
        entityId: adminId,
        before: { name: admin.name, role: admin.role },
        after: { name: row.name, role: row.role },
        ...(request.reason === undefined ? {} : { reason: request.reason }),
        severity: request.role === undefined ? "NOTICE" : "CRITICAL",
        requestId: actor.requestId,
      });

      return row;
    });

    // A role change rewrites the permission list the gateway caches against the session.
    await this.deps.evictor.flush();

    return toAdminUser(updated);
  }
}
