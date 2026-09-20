import { Query } from "@zudojs/cqrs";
import { WALLET_QUERY } from "../../../../constants/index.js";

export class ListTransactionsQuery extends Query<"wallet.listTransactions"> {
  public readonly userId: string;

  public constructor(userId: string) {
    super(WALLET_QUERY.LIST_TRANSACTIONS);
    this.userId = userId;
  }
}
