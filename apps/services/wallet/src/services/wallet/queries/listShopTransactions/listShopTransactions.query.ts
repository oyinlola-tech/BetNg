import { Query } from "@zudojs/cqrs";
import { WALLET_QUERY } from "../../../../constants/index.js";
import type { TimeRange } from "../../../../interfaces/index.js";

export class ListShopTransactionsQuery extends Query<"wallet.listShopTransactions"> {
  public readonly shopId: string;

  public readonly range: TimeRange;

  public readonly limit: number;

  public constructor(payload: {
    readonly shopId: string;
    readonly range: TimeRange;
    readonly limit: number;
  }) {
    super(WALLET_QUERY.LIST_SHOP_TRANSACTIONS);
    this.shopId = payload.shopId;
    this.range = payload.range;
    this.limit = payload.limit;
  }
}
