import { QueryHandler } from "@zudojs/cqrs";
import type { Bet } from "@betng/contracts";
import { BETTING_QUERY } from "../../../../constants/index.js";
import type {
  BetFilter,
  BetRepository,
} from "../../../../interfaces/index.js";
import type { ListBetsQuery } from "./listBets.query.js";

/** Reads bets from the betting repository. */
export class ListBetsHandler extends QueryHandler<
  ListBetsQuery,
  readonly Bet[]
> {
  public readonly queryType = BETTING_QUERY.LIST_BETS;

  private readonly bets: BetRepository;

  public constructor(bets: BetRepository) {
    super();
    this.bets = bets;
  }

  public async execute(query: ListBetsQuery): Promise<readonly Bet[]> {
    const filter: BetFilter = {
      ...(query.userId === undefined ? {} : { userId: query.userId }),
      ...(query.status === undefined ? {} : { status: query.status }),
    };

    return this.bets.list(filter);
  }
}
