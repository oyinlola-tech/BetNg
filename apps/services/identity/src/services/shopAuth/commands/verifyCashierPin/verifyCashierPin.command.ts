import { Command } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";

export class VerifyCashierPinCommand extends Command<"identity.verifyCashierPin"> {
  public readonly cashierId: string;

  public readonly pin: string;

  public constructor(cashierId: string, pin: string) {
    super(IDENTITY_COMMAND.VERIFY_CASHIER_PIN);
    this.cashierId = cashierId;
    this.pin = pin;
  }
}
