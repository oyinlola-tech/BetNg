import { CommandHandler } from "@zudojs/cqrs";
import type { AdminShopSummary } from "@betng/contracts";
import {
  AUDIT_ACTION,
  AUDIT_ENTITY,
  IDENTITY_COMMAND,
  LIST_LIMIT,
} from "../../../../constants/index.js";
import { ConflictError, ResourceNotFoundError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { summariseShop } from "../../shopSummary.helper.js";
import type { SetShopStatusCommand } from "./setShopStatus.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "readModel" | "audit" | "evictor">;

export class SetShopStatusHandler extends CommandHandler<SetShopStatusCommand, AdminShopSummary> {
  public readonly commandType = IDENTITY_COMMAND.SET_SHOP_STATUS;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: SetShopStatusCommand): Promise<AdminShopSummary> {
    const { store, audit } = this.deps;
    const { actor, shopId, status, reason } = command;

    const updated = await store.transaction(async (repositories) => {
      const shop = await repositories.shops.findById(shopId);

      if (shop === undefined) {
        throw new ResourceNotFoundError("That shop does not exist.");
      }

      if (shop.status === status) {
        throw new ConflictError(`That shop is already ${status.toLowerCase()}.`);
      }

      const next = await repositories.shops.setStatus(shopId, status);

      if (status === "SUSPENDED") {
        const staff = await repositories.cashiers.listByShop(shopId, LIST_LIMIT.CASHIERS);

        await repositories.sessions.revokeForSubjects(
          "CASHIER",
          staff.map((cashier) => cashier.id),
          new Date(),
        );
      }

      await audit.write(repositories, {
        actorId: actor.id,
        actorRole: actor.role,
        actorName: actor.name,
        action: AUDIT_ACTION.SHOP_STATUS_CHANGED,
        entityType: AUDIT_ENTITY.SHOP,
        entityId: shopId,
        before: { status: shop.status },
        after: { status },
        reason,
        severity: "WARNING",
        requestId: actor.requestId,
      });

      return next;
    });

    await this.deps.evictor.flush();

    return summariseShop(this.deps, updated);
  }
}
