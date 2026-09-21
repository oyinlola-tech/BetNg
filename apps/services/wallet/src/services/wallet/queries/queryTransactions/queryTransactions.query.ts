import { Query } from "@zudojs/cqrs";
import { WALLET_QUERY } from "../../../../constants/index.js";
import type { EntryPageFilter, OwnerType } from "../../../../interfaces/index.js";

export class QueryTransactionsQuery extends Query<"wallet.queryTransactions"> {
  public readonly ownerType: OwnerType;

  public readonly ownerId: string;

  public readonly filter: EntryPageFilter;

  public constructor(payload: {
    readonly ownerType: OwnerType;
    readonly ownerId: string;
    readonly filter: EntryPageFilter;
  }) {
    super(WALLET_QUERY.QUERY_TRANSACTIONS);
    this.ownerType = payload.ownerType;
    this.ownerId = payload.ownerId;
    this.filter = payload.filter;
  }
}
