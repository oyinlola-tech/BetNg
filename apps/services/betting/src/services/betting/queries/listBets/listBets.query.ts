import { Query } from "@zudojs/cqrs";
import type { BetStatus } from "@betng/contracts";
import { BETTING_QUERY } from "../../../../constants/index.js";

export class ListBetsQuery extends Query<"betting.listBets"> {
  public readonly userId: string;

  public readonly status: BetStatus | undefined;

  public readonly limit: number;

  public constructor(filter: {
    readonly userId: string;
    readonly status?: BetStatus | undefined;
    readonly limit: number;
  }) {
    super(BETTING_QUERY.LIST_BETS);
    this.userId = filter.userId;
    this.status = filter.status;
    this.limit = filter.limit;
  }
}
