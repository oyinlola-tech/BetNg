import { QueryHandler } from "@zudojs/cqrs";
import { WALLET_QUERY } from "../../../../constants/index.js";
import type {
  EntryRecord,
  WalletRepository,
} from "../../../../interfaces/index.js";
import type { ListTransactionsQuery } from "./listTransactions.query.js";

export class ListTransactionsHandler extends QueryHandler<
  ListTransactionsQuery,
  readonly EntryRecord[]
> {
  public readonly queryType = WALLET_QUERY.LIST_TRANSACTIONS;

  private readonly wallets: WalletRepository;

  public constructor(wallets: WalletRepository) {
    super();
    this.wallets = wallets;
  }

  public async execute(
    query: ListTransactionsQuery,
  ): Promise<readonly EntryRecord[]> {
    const account = await this.wallets.getOrOpenAccount(
      query.ownerType,
      query.ownerId,
    );

    return this.wallets.listEntries(account.id, query.limit);
  }
}
