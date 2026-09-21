import { Command } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { AdminActor } from "../../../../interfaces/index.js";

export class ResetCashierCredentialsCommand extends Command<"identity.resetCashierCredentials"> {
  public readonly actor: AdminActor;

  public readonly shopId: string;

  public readonly cashierId: string;

  public constructor(actor: AdminActor, shopId: string, cashierId: string) {
    super(IDENTITY_COMMAND.RESET_CASHIER_CREDENTIALS);
    this.actor = actor;
    this.shopId = shopId;
    this.cashierId = cashierId;
  }
}
