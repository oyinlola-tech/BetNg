import { Command } from "@zudojs/cqrs";
import type { CreateCashierRequest } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { AdminActor } from "../../../../interfaces/index.js";

export class CreateCashierCommand extends Command<"identity.createCashier"> {
  public readonly actor: AdminActor;

  public readonly shopId: string;

  public readonly request: CreateCashierRequest;

  public constructor(actor: AdminActor, shopId: string, request: CreateCashierRequest) {
    super(IDENTITY_COMMAND.CREATE_CASHIER);
    this.actor = actor;
    this.shopId = shopId;
    this.request = request;
  }
}
