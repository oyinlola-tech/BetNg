import { CommandHandler } from "@zudojs/cqrs";
import type { EventBus } from "@zudojs/events";
import { WALLET_COMMAND } from "../../../../constants/index.js";
import { LedgerEntryAppendedEvent } from "../../../../events/index.js";
import type {
  LedgerResult,
  WalletRepository,
} from "../../../../interfaces/index.js";
import type { WithdrawFundsCommand } from "./withdrawFunds.command.js";

/**
 * Debits a simulated wallet.
 *
 * The amount is negated so it reaches the ledger as a debit; the
 * repository refuses an entry that would take the balance below zero.
 */
export class WithdrawFundsHandler extends CommandHandler<
  WithdrawFundsCommand,
  LedgerResult
> {
  public readonly commandType = WALLET_COMMAND.WITHDRAW_FUNDS;

  private readonly wallets: WalletRepository;

  private readonly events: EventBus;

  public constructor(wallets: WalletRepository, events: EventBus) {
    super();
    this.wallets = wallets;
    this.events = events;
  }

  public async execute(command: WithdrawFundsCommand): Promise<LedgerResult> {
    const result = await this.wallets.applyEntry({
      userId: command.userId,
      type: "WITHDRAWAL",
      amount: -command.amount,
    });

    await this.events.publish(
      LedgerEntryAppendedEvent.create({
        walletId: result.wallet.id,
        userId: result.wallet.userId,
        transactionId: result.transaction.id,
        type: result.transaction.type,
        amount: result.transaction.amount,
        balanceAfter: result.transaction.balanceAfter,
        currency: result.transaction.currency,
      }),
    );

    return result;
  }
}
