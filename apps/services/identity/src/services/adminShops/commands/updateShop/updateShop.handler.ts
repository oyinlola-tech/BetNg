import { CommandHandler } from "@zudojs/cqrs";
import type { AdminShopSummary } from "@betng/contracts";
import { AUDIT_ACTION, AUDIT_ENTITY, IDENTITY_COMMAND } from "../../../../constants/index.js";
import { InvalidInputError, ResourceNotFoundError } from "../../../../errors/index.js";
import type { HandlerDependencies, ShopDetails } from "../../../../interfaces/index.js";
import { normaliseEmail, normaliseShopCode } from "../../../../utils/index.js";
import { summariseShop } from "../../shopSummary.helper.js";
import type { UpdateShopCommand } from "./updateShop.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "readModel" | "audit">;

type EditableField = Exclude<keyof ShopDetails, "code">;

const EDITABLE: readonly EditableField[] = ["name", "address", "phone", "email", "ownerName"];

export class UpdateShopHandler extends CommandHandler<UpdateShopCommand, AdminShopSummary> {
  public readonly commandType = IDENTITY_COMMAND.UPDATE_SHOP;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: UpdateShopCommand): Promise<AdminShopSummary> {
    const { store, audit } = this.deps;
    const { actor, shopId, changes, reason } = command;

    const updated = await store.transaction(async (repositories) => {
      const shop = await repositories.shops.findById(shopId);

      if (shop === undefined) {
        throw new ResourceNotFoundError("That shop does not exist.");
      }

      // Tickets and cashier sign-ins carry the code; changing it would orphan both.
      if (changes.code !== undefined && normaliseShopCode(changes.code) !== shop.code) {
        throw new InvalidInputError("code", "A shop's code cannot be changed.");
      }

      const next: Partial<Record<EditableField, string>> = {};
      const before: Partial<Record<EditableField, string>> = {};

      for (const field of EDITABLE) {
        const raw = changes[field];
        const value =
          raw === undefined ? undefined : field === "email" ? normaliseEmail(raw) : raw.trim();

        if (value !== undefined && value !== shop[field]) {
          next[field] = value;
          before[field] = shop[field];
        }
      }

      if (Object.keys(next).length === 0) {
        return shop;
      }

      const saved = await repositories.shops.update(shopId, next);

      await audit.write(repositories, {
        actorId: actor.id,
        actorRole: actor.role,
        actorName: actor.name,
        action: AUDIT_ACTION.SHOP_UPDATED,
        entityType: AUDIT_ENTITY.SHOP,
        entityId: shopId,
        before,
        after: next,
        reason,
        severity: "NOTICE",
        requestId: actor.requestId,
      });

      return saved;
    });

    return summariseShop(this.deps, updated);
  }
}
