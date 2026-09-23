import { CommandHandler } from "@zudojs/cqrs";
import type { Cashier } from "@betng/contracts";
import { AUDIT_ACTION, AUDIT_ENTITY, IDENTITY_COMMAND } from "../../../../constants/index.js";
import { toCashier } from "../../../../dtos/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { requireOwnCashier } from "../../shopStaff.guard.js";
import type { SetShopCashierStatusCommand } from "./setShopCashierStatus.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "audit" | "evictor">;

export class SetShopCashierStatusHandler extends CommandHandler<SetShopCashierStatusCommand, Cashier> {
  public readonly commandType = IDENTITY_COMMAND.SET_SHOP_CASHIER_STATUS;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: SetShopCashierStatusCommand): Promise<Cashier> {
    const { store, audit } = this.deps;
    const { actor, cashierId, status, reason } = command;

    const updated = await store.transaction(async (repositories) => {
      const cashier = await requireOwnCashier(repositories, actor, cashierId);
      const row = await repositories.cashiers.setStatus(cashierId, status);

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

      return row;
    });

    await this.deps.evictor.flush();

    return toCashier(updated);
  }
}
