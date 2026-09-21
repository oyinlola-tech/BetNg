import { CommandHandler } from "@zudojs/cqrs";
import { WALLET_COMMAND } from "../../../../constants/index.js";
import type {
  PostEntryResult,
  WalletRepository,
} from "../../../../interfaces/index.js";
import type { WithdrawFundsCommand } from "./withdrawFunds.command.js";

export class WithdrawFundsHandler extends CommandHandler<
  WithdrawFundsCommand,
  PostEntryResult
> {
  public readonly commandType = WALLET_COMMAND.WITHDRAW_FUNDS;

  private readonly wallets: WalletRepository;

  public constructor(wallets: WalletRepository) {
    super();
    this.wallets = wallets;
  }

  public async execute(command: WithdrawFundsCommand): Promise<PostEntryResult> {
    return this.wallets.postEntry({
      ownerType: "CUSTOMER",
      ownerId: command.customerId,
      type: "WITHDRAWAL",
      amount: -BigInt(command.amount),
      // Namespaced so a customer can never occupy a key another service uses for a stake or payout.
      idempotencyKey: `withdrawal:${command.idempotencyKey}`,
      actorId: command.customerId,
    });
  }
}
