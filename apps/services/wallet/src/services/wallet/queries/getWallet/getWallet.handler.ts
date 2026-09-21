import { QueryHandler } from "@zudojs/cqrs";
import { WALLET_QUERY } from "../../../../constants/index.js";
import type {
  AccountRecord,
  WalletRepository,
} from "../../../../interfaces/index.js";
import type { GetWalletQuery } from "./getWallet.query.js";

export class GetWalletHandler extends QueryHandler<
  GetWalletQuery,
  AccountRecord
> {
  public readonly queryType = WALLET_QUERY.GET_WALLET;

  private readonly wallets: WalletRepository;

  public constructor(wallets: WalletRepository) {
    super();
    this.wallets = wallets;
  }

  public async execute(query: GetWalletQuery): Promise<AccountRecord> {
    return this.wallets.getOrOpenAccount(query.ownerType, query.ownerId);
  }
}
