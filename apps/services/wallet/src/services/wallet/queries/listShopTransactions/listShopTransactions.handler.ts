import { QueryHandler } from "@zudojs/cqrs";
import { WALLET_QUERY } from "../../../../constants/index.js";
import type {
  ShopEntryRecord,
  WalletRepository,
} from "../../../../interfaces/index.js";
import type { ListShopTransactionsQuery } from "./listShopTransactions.query.js";

export class ListShopTransactionsHandler extends QueryHandler<
  ListShopTransactionsQuery,
  readonly ShopEntryRecord[]
> {
  public readonly queryType = WALLET_QUERY.LIST_SHOP_TRANSACTIONS;

  private readonly wallets: WalletRepository;

  public constructor(wallets: WalletRepository) {
    super();
    this.wallets = wallets;
  }

  public async execute(
    query: ListShopTransactionsQuery,
  ): Promise<readonly ShopEntryRecord[]> {
    return this.wallets.listShopEntries(query.shopId, query.range, query.limit);
  }
}
