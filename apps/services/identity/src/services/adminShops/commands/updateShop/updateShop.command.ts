import { Command } from "@zudojs/cqrs";
import type { CreateShopRequest } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { AdminActor } from "../../../../interfaces/index.js";

export class UpdateShopCommand extends Command<"identity.updateShop"> {
  public readonly actor: AdminActor;

  public readonly shopId: string;

  public readonly changes: Partial<CreateShopRequest>;

  public readonly reason: string | undefined;

  public constructor(payload: {
    readonly actor: AdminActor;
    readonly shopId: string;
    readonly changes: Partial<CreateShopRequest>;
    readonly reason: string | undefined;
  }) {
    super(IDENTITY_COMMAND.UPDATE_SHOP);
    this.actor = payload.actor;
    this.shopId = payload.shopId;
    this.changes = payload.changes;
    this.reason = payload.reason;
  }
}
