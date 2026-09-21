import { CommandHandler } from "@zudojs/cqrs";
import { isConflictError } from "@zudojs/database";
import type { AdminShopSummary } from "@betng/contracts";
import { AUDIT_ACTION, AUDIT_ENTITY, IDENTITY_COMMAND } from "../../../../constants/index.js";
import { ConflictError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { normaliseEmail, normaliseShopCode } from "../../../../utils/index.js";
import { summariseShop } from "../../shopSummary.helper.js";
import type { CreateShopCommand } from "./createShop.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "readModel" | "audit">;

export class CreateShopHandler extends CommandHandler<CreateShopCommand, AdminShopSummary> {
  public readonly commandType = IDENTITY_COMMAND.CREATE_SHOP;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: CreateShopCommand): Promise<AdminShopSummary> {
    const { store, audit } = this.deps;
    const { actor, request } = command;

    const details = {
      code: normaliseShopCode(request.code),
      name: request.name.trim(),
      address: request.address.trim(),
      phone: request.phone.trim(),
      email: normaliseEmail(request.email),
      ownerName: request.ownerName.trim(),
    };

    try {
      const shop = await store.transaction(async (repositories) => {
        const created = await repositories.shops.create(details);

        await audit.write(repositories, {
          actorId: actor.id,
          actorRole: actor.role,
          actorName: actor.name,
          action: AUDIT_ACTION.SHOP_CREATED,
          entityType: AUDIT_ENTITY.SHOP,
          entityId: created.id,
          after: details,
          severity: "NOTICE",
          requestId: actor.requestId,
        });

        return created;
      });

      return await summariseShop(this.deps, shop);
    } catch (error) {
      if (isConflictError(error)) {
        throw new ConflictError(`Shop code ${details.code} is already in use.`);
      }

      throw error;
    }
  }
}
