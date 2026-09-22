import { Command } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";

export class CheckLimitsCommand extends Command<"identity.checkLimits"> {
  public readonly customerId: string;

  public readonly action: "DEPOSIT" | "BET" | "WITHDRAWAL";

  public readonly amount: number;

  public constructor(customerId: string, action: "DEPOSIT" | "BET" | "WITHDRAWAL", amount: number) {
    super(IDENTITY_COMMAND.CHECK_LIMITS);
    this.customerId = customerId;
    this.action = action;
    this.amount = amount;
  }
}
