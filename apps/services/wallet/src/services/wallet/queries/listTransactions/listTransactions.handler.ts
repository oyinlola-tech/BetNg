import { QueryHandler } from "@zudojs/cqrs";
import type { Transaction } from "@betng/contracts";
import { WALLET_QUERY } from "../../../../constants/index.js";
import type { WalletRepository } from "../../../../interfaces/index.js";
import type { ListTransactionsQuery } from "./listTransactions.query.js";

export class ListTransactionsHandler extends QueryHandler<
  ListTransactionsQuery,
  readonly Transaction[]
> {
  public readonly queryType = WALLET_QUERY.LIST_TRANSACTIONS;

  private readonly wallets: WalletRepository;

  public constructor(wallets: WalletRepository) {
    super();
    this.wallets = wallets;
  }

  public async execute(
    query: ListTransactionsQuery,
  ): Promise<readonly Transaction[]> {
    return this.wallets.listTransactions(query.userId);
  }
}
