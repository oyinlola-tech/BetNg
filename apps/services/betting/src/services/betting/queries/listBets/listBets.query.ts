import { Query } from "@zudojs/cqrs";
import type { BetStatus } from "@betng/contracts";
import { BETTING_QUERY } from "../../../../constants/index.js";

/** Asks for bets, optionally narrowed by holder and status. */
export class ListBetsQuery extends Query<"betting.listBets"> {
  public readonly userId: string | undefined;

  public readonly status: BetStatus | undefined;

  public constructor(
    filter: {
      readonly userId?: string;
      readonly status?: BetStatus;
    } = {},
  ) {
    super(BETTING_QUERY.LIST_BETS);
    this.userId = filter.userId;
    this.status = filter.status;
  }
}
