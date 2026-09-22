import { CommandHandler } from "@zudojs/cqrs";
import type { AdminCustomer } from "@betng/contracts";
import { AUDIT_ACTION, AUDIT_ENTITY, IDENTITY_COMMAND } from "../../../../constants/index.js";
import { toAdminCustomer } from "../../../../dtos/index.js";
import { ResourceNotFoundError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { profileChange } from "../../../customerAuth/profileChange.helper.js";
import type { AdminUpdateCustomerCommand } from "./updateCustomer.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "readModel" | "audit" | "messenger">;

/** Name and phone only; balances are never edited here. The customer is told their details were changed by support. */
export class AdminUpdateCustomerHandler extends CommandHandler<AdminUpdateCustomerCommand, AdminCustomer> {
  public readonly commandType = IDENTITY_COMMAND.ADMIN_UPDATE_CUSTOMER;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: AdminUpdateCustomerCommand): Promise<AdminCustomer> {
    const { store, readModel, audit, messenger } = this.deps;
    const { actor, customerId, reason } = command;

    const outcome = await store.transaction(async (repositories) => {
      const customer = await repositories.customers.findById(customerId);

      if (customer === undefined || customer.deletedAt !== null) {
        throw new ResourceNotFoundError("That customer does not exist.");
      }

      const change = profileChange(customer, command.changes);

      if (change === undefined) {
        return { row: customer, changed: false };
      }

      const row = await repositories.customers.updateProfile(customerId, change.changes);

      await audit.write(repositories, {
        actorId: actor.id,
        actorRole: actor.role,
        actorName: actor.name,
        action: AUDIT_ACTION.CUSTOMER_PROFILE_UPDATED,
        entityType: AUDIT_ENTITY.CUSTOMER,
        entityId: customerId,
        before: change.before,
        after: change.after,
        reason,
        severity: "WARNING",
        requestId: actor.requestId,
      });

      return { row, changed: true };
    });

    if (outcome.changed) {
      void messenger.securityAlert(customerId, { kind: "PROFILE_UPDATED", bySupport: true });
    }

    const figures = await readModel.customerFigures([outcome.row.id]);

    return toAdminCustomer(outcome.row, figures.get(outcome.row.id));
  }
}
