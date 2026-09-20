import { QueryHandler } from "@zudojs/cqrs";
import type { Wallet } from "@betng/contracts";
import { WALLET_QUERY } from "../../../../constants/index.js";
import { WalletNotFoundError } from "../../../../errors/index.js";
import type { WalletRepository } from "../../../../interfaces/index.js";
import type { GetWalletQuery } from "./getWallet.query.js";

/**
 * Reads one user's wallet.
 *
 * A read does not create a wallet: a user who has never transacted has
 * none, and saying so is more useful than inventing an empty one.
 */
export class GetWalletHandler extends QueryHandler<GetWalletQuery, Wallet> {
  public readonly queryType = WALLET_QUERY.GET_WALLET;

  private readonly wallets: WalletRepository;

  public constructor(wallets: WalletRepository) {
    super();
    this.wallets = wallets;
  }

  public async execute(query: GetWalletQuery): Promise<Wallet> {
    const found = await this.wallets.findByUser(query.userId);

    if (found === undefined) {
      throw new WalletNotFoundError(query.userId);
    }

    return found;
  }
}
