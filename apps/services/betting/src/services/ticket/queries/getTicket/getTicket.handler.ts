import { QueryHandler } from "@zudojs/cqrs";
import { BETTING_QUERY } from "../../../../constants/index.js";
import { ticketNotFound } from "../../../../errors/index.js";
import type {
  BetRepository,
  TicketRecord,
} from "../../../../interfaces/index.js";
import type { GetTicketQuery } from "./getTicket.query.js";

export class GetTicketHandler extends QueryHandler<GetTicketQuery, TicketRecord> {
  public readonly queryType = BETTING_QUERY.GET_TICKET;

  private readonly bets: BetRepository;

  public constructor(bets: BetRepository) {
    super();
    this.bets = bets;
  }

  public async execute(query: GetTicketQuery): Promise<TicketRecord> {
    const found = await this.bets.findTicket(query.code, query.shopId);

    if (found === undefined) {
      throw ticketNotFound();
    }

    return found;
  }
}
