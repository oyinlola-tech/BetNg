import { CommandHandler } from "@zudojs/cqrs";
import type { AdminCashierSummary } from "@betng/contracts";
import { AUDIT_ACTION, AUDIT_ENTITY, IDENTITY_COMMAND } from "../../../../constants/index.js";
import { toAdminCashierSummary } from "../../../../dtos/index.js";
import { ConflictError, ResourceNotFoundError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import type { SetCashierStatusCommand } from "./setCashierStatus.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "readModel" | "audit">;

export class SetCashierStatusHandler extends CommandHandler<SetCashierStatusCommand, AdminCashierSummary> {
  public readonly commandType = IDENTITY_COMMAND.SET_CASHIER_STATUS;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: SetCashierStatusCommand): Promise<AdminCashierSummary> {
    const { store, readModel, audit } = this.deps;
    const { actor, shopId, cashierId, status, reason } = command;

    const updated = await store.transaction(async (repositories) => {
      const cashier = await repositories.cashiers.findById(cashierId);

      // A cashier of another shop is as absent as one that does not exist.
      if (cashier === undefined || cashier.shopId !== shopId) {
        throw new ResourceNotFoundError("That cashier does not exist.");
      }

      if (cashier.status === status) {
        throw new ConflictError(`That cashier is already ${status.toLowerCase()}.`);
      }

      const next = await repositories.cashiers.setStatus(cashierId, status);

      if (status === "SUSPENDED") {
        await repositories.sessions.revokeForSubjects("CASHIER", [cashierId], new Date());
      }

      await audit.write(repositories, {
        actorId: actor.id,
        actorRole: actor.role,
        actorName: actor.name,
        action: AUDIT_ACTION.CASHIER_STATUS_CHANGED,
        entityType: AUDIT_ENTITY.CASHIER,
        entityId: cashierId,
        before: { status: cashier.status },
        after: { status },
        reason,
        severity: "WARNING",
        requestId: actor.requestId,
      });

      return next;
    });

    const figures = await readModel.cashierFigures([updated.id]);

    return toAdminCashierSummary(updated, figures.get(updated.id));
  }
}
