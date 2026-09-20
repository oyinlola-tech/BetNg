import { CommandHandler } from "@zudojs/cqrs";
import { WALLET_COMMAND } from "../../../../constants/index.js";
import type {
  LedgerResult,
  WalletRepository,
} from "../../../../interfaces/index.js";
import type { DepositFundsCommand } from "./depositFunds.command.js";

/**
 * Credits a simulated wallet.
 *
 * The amount is appended to the ledger as a positive entry and the balance
 * is derived from it; nothing writes a balance directly.
 */
export class DepositFundsHandler extends CommandHandler<
  DepositFundsCommand,
  LedgerResult
> {
  public readonly commandType = WALLET_COMMAND.DEPOSIT_FUNDS;

  private readonly wallets: WalletRepository;

  public constructor(wallets: WalletRepository) {
    super();
    this.wallets = wallets;
  }

  public async execute(command: DepositFundsCommand): Promise<LedgerResult> {
    return this.wallets.applyEntry({
      userId: command.userId,
      type: "DEPOSIT",
      amount: command.amount,
    });
  }
}
