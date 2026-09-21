import { QueryHandler } from "@zudojs/cqrs";
import { BETTING_QUERY } from "../../../../constants/index.js";
import { betNotFound } from "../../../../errors/index.js";
import type {
  BetRecord,
  BetRepository,
} from "../../../../interfaces/index.js";
import type { GetBetQuery } from "./getBet.query.js";

// Someone else's bet answers exactly like a missing one, so ids cannot be probed.
export class GetBetHandler extends QueryHandler<GetBetQuery, BetRecord> {
  public readonly queryType = BETTING_QUERY.GET_BET;

  private readonly bets: BetRepository;

  public constructor(bets: BetRepository) {
    super();
    this.bets = bets;
  }

  public async execute(query: GetBetQuery): Promise<BetRecord> {
    const found = await this.bets.findBet(query.betId);

    if (found === undefined || found.userId !== query.userId) {
      throw betNotFound();
    }

    return found;
  }
}
