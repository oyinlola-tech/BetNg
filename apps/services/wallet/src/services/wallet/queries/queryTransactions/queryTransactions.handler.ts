import { QueryHandler } from "@zudojs/cqrs";
import { WALLET_QUERY } from "../../../../constants/index.js";
import type {
  EntryPage,
  WalletRepository,
} from "../../../../interfaces/index.js";
import type { QueryTransactionsQuery } from "./queryTransactions.query.js";

export class QueryTransactionsHandler extends QueryHandler<
  QueryTransactionsQuery,
  EntryPage
> {
  public readonly queryType = WALLET_QUERY.QUERY_TRANSACTIONS;

  private readonly wallets: WalletRepository;

  public constructor(wallets: WalletRepository) {
    super();
    this.wallets = wallets;
  }

  public async execute(query: QueryTransactionsQuery): Promise<EntryPage> {
    const account = await this.wallets.getOrOpenAccount(
      query.ownerType,
      query.ownerId,
    );

    return this.wallets.pageEntries(account.id, query.filter);
  }
}
