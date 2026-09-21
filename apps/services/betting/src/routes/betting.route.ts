import { API_PREFIX } from "@betng/contracts";
import { json } from "@betng/service-kit";
import type { HttpRouter } from "@betng/service-kit";
import type {
  BettingController,
  TicketController,
} from "../controllers/index.js";
import { withDatabaseFailure } from "../middlewares/index.js";

// No route is public: each controller re-checks the gateway's actor.
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
