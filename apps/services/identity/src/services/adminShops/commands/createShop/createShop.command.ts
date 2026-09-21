import { Command } from "@zudojs/cqrs";
import type { CreateShopRequest } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { AdminActor } from "../../../../interfaces/index.js";

export class CreateShopCommand extends Command<"identity.createShop"> {
  public readonly actor: AdminActor;

  public readonly request: CreateShopRequest;

  public constructor(actor: AdminActor, request: CreateShopRequest) {
    super(IDENTITY_COMMAND.CREATE_SHOP);
    this.actor = actor;
    this.request = request;
  }
}
