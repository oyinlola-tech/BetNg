import { CommandHandler } from "@zudojs/cqrs";
import { WALLET_COMMAND } from "../../../../constants/index.js";
import type {
  LedgerResult,
  WalletRepository,
} from "../../../../interfaces/index.js";
import type { WithdrawFundsCommand } from "./withdrawFunds.command.js";

/**
 * Debits a simulated wallet.
 *
 * The amount is negated so it reaches the ledger as a debit; the repository
 * refuses an entry that would take the balance below zero.
 */
export class WithdrawFundsHandler extends CommandHandler<
  WithdrawFundsCommand,
  LedgerResult
> {
  public readonly commandType = WALLET_COMMAND.WITHDRAW_FUNDS;

  private readonly wallets: WalletRepository;

  public constructor(wallets: WalletRepository) {
    super();
    this.wallets = wallets;
  }

  public async execute(command: WithdrawFundsCommand): Promise<LedgerResult> {
    return this.wallets.applyEntry({
      userId: command.userId,
      type: "WITHDRAWAL",
      amount: -command.amount,
    });
  }
}
