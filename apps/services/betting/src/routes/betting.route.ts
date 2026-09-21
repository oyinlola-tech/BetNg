import { API_PREFIX } from "@betng/contracts";
import { json } from "@betng/service-kit";
import type { HttpRouter } from "@betng/service-kit";
import type {
  BettingController,
  TicketController,
} from "../controllers/index.js";
import { withDatabaseFailure } from "../middlewares/index.js";

/**
 * Every route reads the gateway's actor and re-checks what it needs; none is
 * public. Placement answers 201 for a new bet and 200 for an idempotent
 * replay, so those two handlers build their own response.
 */
export function registerBettingRoutes(
  router: HttpRouter,
  bets: BettingController,
  tickets: TicketController,
): void {
  router.post(`${API_PREFIX}/bets`, withDatabaseFailure(bets.placeBet));
  router.get(`${API_PREFIX}/bets`, withDatabaseFailure(json(bets.listBets)));
  router.get(`${API_PREFIX}/bets/:id`, withDatabaseFailure(json(bets.getBet)));

  router.post(
    `${API_PREFIX}/shop/tickets`,
    withDatabaseFailure(tickets.sellTicket),
  );
  router.get(
    `${API_PREFIX}/shop/tickets`,
    withDatabaseFailure(json(tickets.listTickets)),
  );
  router.get(
    `${API_PREFIX}/shop/tickets/:code`,
    withDatabaseFailure(json(tickets.getTicket)),
  );
  router.post(
    `${API_PREFIX}/shop/tickets/:code/payout`,
    withDatabaseFailure(json(tickets.payoutTicket)),
  );
  router.post(
    `${API_PREFIX}/shop/tickets/:code/cancel`,
    withDatabaseFailure(json(tickets.cancelTicket)),
  );
}
