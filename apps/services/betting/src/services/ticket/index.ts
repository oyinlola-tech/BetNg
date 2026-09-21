import type { Container } from "@zudojs/container";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import {
  BET_REPOSITORY_TOKEN,
  BETTING_COMMAND,
  BETTING_QUERY,
  CLOCK_TOKEN,
  IDENTITY_PEER_TOKEN,
  LOGGER_TOKEN,
  MARKET_READER_TOKEN,
  WALLET_PEER_TOKEN,
} from "../../constants/index.js";
import { CancelTicketHandler, PayoutTicketHandler } from "./commands/index.js";
import { GetTicketHandler, ListTicketsHandler } from "./queries/index.js";

export interface TicketServiceConfig {
  readonly container: Container;
  readonly commandBus: CommandBus;
  readonly queryBus: QueryBus;
}

/** Selling a ticket is a placement, so it lives with the betting service. */
export function registerTicketService(config: TicketServiceConfig): void {
  const { container, commandBus, queryBus } = config;

  const shared = {
    bets: container.resolve(BET_REPOSITORY_TOKEN),
    wallet: container.resolve(WALLET_PEER_TOKEN),
    identity: container.resolve(IDENTITY_PEER_TOKEN),
    logger: container.resolve(LOGGER_TOKEN),
    now: container.resolve(CLOCK_TOKEN),
  };

  commandBus.register(
    BETTING_COMMAND.PAYOUT_TICKET,
    new PayoutTicketHandler(shared),
  );

  commandBus.register(
    BETTING_COMMAND.CANCEL_TICKET,
    new CancelTicketHandler({
      ...shared,
      markets: container.resolve(MARKET_READER_TOKEN),
    }),
  );

  queryBus.register(BETTING_QUERY.GET_TICKET, new GetTicketHandler(shared.bets));
  queryBus.register(
    BETTING_QUERY.LIST_TICKETS,
    new ListTicketsHandler(shared.bets),
  );
}
