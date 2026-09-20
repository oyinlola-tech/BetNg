import { Command } from "@zudojs/cqrs";
import type { Currency } from "@betng/contracts";
import { WALLET_COMMAND } from "../../../../constants/index.js";

/** Asks for a simulated top-up. No payment provider is involved. */
export class DepositFundsCommand extends Command<"wallet.depositFunds"> {
  public readonly userId: string;

  public readonly amount: number;

  public readonly currency: Currency;

  public constructor(payload: {
    readonly userId: string;
    readonly amount: number;
    readonly currency: Currency;
  }) {
    super(WALLET_COMMAND.DEPOSIT_FUNDS);
    this.userId = payload.userId;
    this.amount = payload.amount;
    this.currency = payload.currency;
  }
}
