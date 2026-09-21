import { QueryHandler } from "@zudojs/cqrs";
import { BETTING_QUERY } from "../../../../constants/index.js";
import type {
  BetRecord,
  BetRepository,
} from "../../../../interfaces/index.js";
import type { ListBetsQuery } from "./listBets.query.js";

export class ListBetsHandler extends QueryHandler<
  ListBetsQuery,
  readonly BetRecord[]
> {
  public readonly queryType = BETTING_QUERY.LIST_BETS;

  private readonly bets: BetRepository;

  public constructor(bets: BetRepository) {
    super();
    this.bets = bets;
  }

  public async execute(query: ListBetsQuery): Promise<readonly BetRecord[]> {
    return this.bets.listBets({
      userId: query.userId,
      status: query.status,
      limit: query.limit,
    });
  }
}
