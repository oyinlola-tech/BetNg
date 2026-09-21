import { Command } from "@zudojs/cqrs";
import { WALLET_COMMAND } from "../../../../constants/index.js";

export class WithdrawFundsCommand extends Command<"wallet.withdrawFunds"> {
  public readonly customerId: string;

  public readonly amount: number;

  public readonly idempotencyKey: string;

  public constructor(payload: {
    readonly customerId: string;
    readonly amount: number;
    readonly idempotencyKey: string;
  }) {
    super(WALLET_COMMAND.WITHDRAW_FUNDS);
    this.customerId = payload.customerId;
    this.amount = payload.amount;
    this.idempotencyKey = payload.idempotencyKey;
  }
}
