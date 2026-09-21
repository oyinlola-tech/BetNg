import { QueryHandler } from "@zudojs/cqrs";
import { BETTING_QUERY } from "../../../../constants/index.js";
import type {
  BetRepository,
  TicketRecord,
} from "../../../../interfaces/index.js";
import type { ListTicketsQuery } from "./listTickets.query.js";

/** One shop's tickets, newest first. */
export class ListTicketsHandler extends QueryHandler<
  ListTicketsQuery,
  readonly TicketRecord[]
> {
  public readonly queryType = BETTING_QUERY.LIST_TICKETS;

  private readonly bets: BetRepository;

  public constructor(bets: BetRepository) {
    super();
    this.bets = bets;
  }

  public async execute(
    query: ListTicketsQuery,
  ): Promise<readonly TicketRecord[]> {
    return this.bets.listTickets(query.filter);
  }
}
