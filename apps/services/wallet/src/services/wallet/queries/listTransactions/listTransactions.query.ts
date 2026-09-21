import { Query } from "@zudojs/cqrs";
import { WALLET_QUERY } from "../../../../constants/index.js";
import type { OwnerType } from "../../../../interfaces/index.js";

export class ListTransactionsQuery extends Query<"wallet.listTransactions"> {
  public readonly ownerType: OwnerType;

  public readonly ownerId: string;

  public readonly limit: number;

  public constructor(payload: {
    readonly ownerType: OwnerType;
    readonly ownerId: string;
    readonly limit: number;
  }) {
    super(WALLET_QUERY.LIST_TRANSACTIONS);
    this.ownerType = payload.ownerType;
    this.ownerId = payload.ownerId;
    this.limit = payload.limit;
  }
}
