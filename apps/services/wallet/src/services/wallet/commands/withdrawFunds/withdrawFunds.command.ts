import { Command } from "@zudojs/cqrs";
import type { Currency } from "@betng/contracts";
import { WALLET_COMMAND } from "../../../../constants/index.js";

/** Asks for a simulated withdrawal. No payment provider is involved. */
export class WithdrawFundsCommand extends Command<"wallet.withdrawFunds"> {
  public readonly userId: string;

  /** Simulated amount in minor units, always positive. */
  public readonly amount: number;

  public readonly currency: Currency;

  public constructor(payload: {
    readonly userId: string;
    readonly amount: number;
    readonly currency: Currency;
  }) {
    super(WALLET_COMMAND.WITHDRAW_FUNDS);
    this.userId = payload.userId;
    this.amount = payload.amount;
    this.currency = payload.currency;
  }
}
