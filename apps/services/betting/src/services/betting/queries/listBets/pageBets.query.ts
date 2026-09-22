import { Query } from "@zudojs/cqrs";
import { BETTING_QUERY } from "../../../../constants/index.js";
import type { BetPageFilter } from "../../../../interfaces/index.js";

export class PageBetsQuery extends Query<"betting.pageBets"> {
  public readonly filter: BetPageFilter;

  public constructor(filter: BetPageFilter) {
    super(BETTING_QUERY.PAGE_BETS);
    this.filter = filter;
  }
}
