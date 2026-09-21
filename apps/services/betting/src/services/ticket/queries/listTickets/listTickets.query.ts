import { Query } from "@zudojs/cqrs";
import { BETTING_QUERY } from "../../../../constants/index.js";
import type { TicketFilter } from "../../../../interfaces/index.js";

export class ListTicketsQuery extends Query<"betting.listTickets"> {
  public readonly filter: TicketFilter;

  public constructor(filter: TicketFilter) {
    super(BETTING_QUERY.LIST_TICKETS);
    this.filter = filter;
  }
}
