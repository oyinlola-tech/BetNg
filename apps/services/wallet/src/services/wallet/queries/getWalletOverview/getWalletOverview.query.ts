import { Query } from "@zudojs/cqrs";
import { WALLET_QUERY } from "../../../../constants/index.js";
import type { TimeRange } from "../../../../interfaces/index.js";

export class GetWalletOverviewQuery extends Query<"wallet.getWalletOverview"> {
  public readonly today: TimeRange;

  public readonly limit: number;

  public constructor(payload: {
    readonly today: TimeRange;
    readonly limit: number;
  }) {
    super(WALLET_QUERY.GET_WALLET_OVERVIEW);
    this.today = payload.today;
    this.limit = payload.limit;
  }
}
