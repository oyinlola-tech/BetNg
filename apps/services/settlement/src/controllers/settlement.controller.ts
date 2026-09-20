/**
 * Settlement HTTP handlers.
 *
 * Reads only. Settlement is driven by a completed match result, not by an
 * HTTP request, so there is no endpoint that settles a bet on demand — and
 * there will not be one, because an outside caller must never be able to
 * decide when or how a bet resolves.
 */

import { requireParam } from "@betng/service-kit";
import type { HttpRouterContext } from "@betng/service-kit";
import type { Settlement } from "@betng/contracts";
import type { QueryBus } from "@zudojs/cqrs";
import type { SettlementListDto } from "../dtos/index.js";
import {
  GetSettlementQuery,
  ListSettlementsQuery,
} from "../services/settlement/queries/index.js";

export interface SettlementController {
  getSettlement(context: HttpRouterContext): Promise<Settlement>;
  listSettlements(): Promise<SettlementListDto>;
}

export function createSettlementController(
  queryBus: QueryBus,
): SettlementController {
  return {
    getSettlement: async (context) =>
      queryBus.execute<GetSettlementQuery, Settlement>(
        new GetSettlementQuery(requireParam(context.params, "betId")),
      ),

    listSettlements: async () => ({
      items: await queryBus.execute<
        ListSettlementsQuery,
        readonly Settlement[]
      >(new ListSettlementsQuery()),
    }),
  };
}
