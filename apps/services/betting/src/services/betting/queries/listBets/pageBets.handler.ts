import { QueryHandler } from "@zudojs/cqrs";
import { BETTING_QUERY } from "../../../../constants/index.js";
import type { BetPage, BetRepository } from "../../../../interfaces/index.js";
import type { PageBetsQuery } from "./pageBets.query.js";

export class PageBetsHandler extends QueryHandler<PageBetsQuery, BetPage> {
  public readonly queryType = BETTING_QUERY.PAGE_BETS;

  private readonly bets: BetRepository;

  public constructor(bets: BetRepository) {
    super();
    this.bets = bets;
  }

  public async execute(query: PageBetsQuery): Promise<BetPage> {
    return this.bets.pageBets(query.filter);
  }
}
