import { CommandHandler } from "@zudojs/cqrs";
import { WALLET_COMMAND } from "../../../../constants/index.js";
import type {
  PostEntryResult,
  WalletRepository,
} from "../../../../interfaces/index.js";
import type { PostEntryCommand } from "./postEntry.command.js";

export class PostEntryHandler extends CommandHandler<
  PostEntryCommand,
  PostEntryResult
> {
  public readonly commandType = WALLET_COMMAND.POST_ENTRY;

  private readonly wallets: WalletRepository;

  public constructor(wallets: WalletRepository) {
    super();
    this.wallets = wallets;
  }

  public async execute(command: PostEntryCommand): Promise<PostEntryResult> {
    return this.wallets.postEntry(command.entry);
  }
}
