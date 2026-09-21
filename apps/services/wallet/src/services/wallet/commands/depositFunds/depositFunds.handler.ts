import { CommandHandler } from "@zudojs/cqrs";
import { WALLET_COMMAND } from "../../../../constants/index.js";
import type {
  PostEntryResult,
  WalletRepository,
} from "../../../../interfaces/index.js";
import type { DepositFundsCommand } from "./depositFunds.command.js";

export class DepositFundsHandler extends CommandHandler<
  DepositFundsCommand,
  PostEntryResult
> {
  public readonly commandType = WALLET_COMMAND.DEPOSIT_FUNDS;

  private readonly wallets: WalletRepository;

  public constructor(wallets: WalletRepository) {
    super();
    this.wallets = wallets;
  }

  public async execute(command: DepositFundsCommand): Promise<PostEntryResult> {
    return this.wallets.postEntry({
      ownerType: "CUSTOMER",
      ownerId: command.customerId,
      type: "DEPOSIT",
      amount: BigInt(command.amount),
      // Namespaced so a customer can never occupy a key another service uses for a stake or payout.
      idempotencyKey: `topup:${command.idempotencyKey}`,
      actorId: command.customerId,
    });
  }
}
