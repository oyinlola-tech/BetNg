import { QueryHandler } from "@zudojs/cqrs";
import type { Bet } from "@betng/contracts";
import { BETTING_QUERY } from "../../../../constants/index.js";
import { BetNotFoundError } from "../../../../errors/index.js";
import type { BetRepository } from "../../../../interfaces/index.js";
import type { GetBetQuery } from "./getBet.query.js";

/**
 * Reads one bet.
 *
 * Raises {@link BetNotFoundError} rather than returning `undefined`, so
 * "no such bet" is answered the same way whichever caller asked.
 */
export class GetBetHandler extends QueryHandler<GetBetQuery, Bet> {
  public readonly queryType = BETTING_QUERY.GET_BET;

  private readonly bets: BetRepository;

  public constructor(bets: BetRepository) {
    super();
    this.bets = bets;
  }

  public async execute(query: GetBetQuery): Promise<Bet> {
    const found = await this.bets.find(query.betId);

    if (found === undefined) {
      throw new BetNotFoundError(query.betId);
    }

    return found;
  }
}
