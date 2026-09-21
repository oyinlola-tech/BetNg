import { Command } from "@zudojs/cqrs";
import { WALLET_COMMAND } from "../../../../constants/index.js";
import type { PostEntryInput } from "../../../../interfaces/index.js";

export class PostEntryCommand extends Command<"wallet.postEntry"> {
  public readonly entry: PostEntryInput;

  public constructor(entry: PostEntryInput) {
    super(WALLET_COMMAND.POST_ENTRY);
    this.entry = entry;
  }
}
