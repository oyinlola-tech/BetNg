import { CommandHandler } from "@zudojs/cqrs";
import type { EventBus } from "@zudojs/events";
import { WALLET_COMMAND } from "../../../../constants/index.js";
import { LedgerEntryAppendedEvent } from "../../../../events/index.js";
import type {
  LedgerResult,
  WalletRepository,
} from "../../../../interfaces/index.js";
import type { DepositFundsCommand } from "./depositFunds.command.js";

/**
 * Credits a simulated wallet.
 *
 * The amount is appended to the ledger as a positive entry and the
 * balance is derived from it; nothing writes a balance directly.
 */
export class DepositFundsHandler extends CommandHandler<
  DepositFundsCommand,
  LedgerResult
> {
  public readonly commandType = WALLET_COMMAND.DEPOSIT_FUNDS;

  private readonly wallets: WalletRepository;

  private readonly events: EventBus;

  public constructor(wallets: WalletRepository, events: EventBus) {
    super();
    this.wallets = wallets;
    this.events = events;
  }

  public async execute(command: DepositFundsCommand): Promise<LedgerResult> {
    const result = await this.wallets.applyEntry({
      userId: command.userId,
      type: "DEPOSIT",
      amount: command.amount,
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
