import { CommandHandler } from "@zudojs/cqrs";
import type { AdminCustomer } from "@betng/contracts";
import { AUDIT_ACTION, AUDIT_ENTITY, IDENTITY_COMMAND } from "../../../../constants/index.js";
import { toAdminCustomer } from "../../../../dtos/index.js";
import { ConflictError, ResourceNotFoundError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import type { SetCustomerStatusCommand } from "./setCustomerStatus.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "readModel" | "audit">;

export class SetCustomerStatusHandler extends CommandHandler<SetCustomerStatusCommand, AdminCustomer> {
  public readonly commandType = IDENTITY_COMMAND.SET_CUSTOMER_STATUS;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: SetCustomerStatusCommand): Promise<AdminCustomer> {
    const { store, readModel, audit } = this.deps;
    const { actor, customerId, status, reason } = command;

    const updated = await store.transaction(async (repositories) => {
      const customer = await repositories.customers.findById(customerId);

      if (customer === undefined) {
        throw new ResourceNotFoundError("That customer does not exist.");
      }

      if (customer.status === status) {
        throw new ConflictError(`That customer is already ${status.toLowerCase()}.`);
      }

      const next = await repositories.customers.setStatus(customerId, status);

      if (status === "SUSPENDED") {
        await repositories.sessions.revokeForSubjects("CUSTOMER", [customerId], new Date());
      }

      await audit.write(repositories, {
        actorId: actor.id,
        actorRole: actor.role,
        actorName: actor.name,
        action: AUDIT_ACTION.CUSTOMER_STATUS_CHANGED,
        entityType: AUDIT_ENTITY.CUSTOMER,
        entityId: customerId,
        before: { status: customer.status },
        after: { status },
        reason,
        severity: "WARNING",
        requestId: actor.requestId,
      });

      return next;
    });

    const figures = await readModel.customerFigures([updated.id]);

    return toAdminCustomer(updated, figures.get(updated.id));
  }
}
