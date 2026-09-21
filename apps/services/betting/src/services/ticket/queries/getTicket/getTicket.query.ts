import { Query } from "@zudojs/cqrs";
import { BETTING_QUERY } from "../../../../constants/index.js";

export class GetTicketQuery extends Query<"betting.getTicket"> {
  public readonly code: string;

  public readonly shopId: string;

  public constructor(code: string, shopId: string) {
    super(BETTING_QUERY.GET_TICKET);
    this.code = code;
    this.shopId = shopId;
  }
}
