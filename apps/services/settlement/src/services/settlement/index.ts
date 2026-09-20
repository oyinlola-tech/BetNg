/**
 * The settlement application service.
 *
 * Registers the settlement read handlers on the query bus, resolving the
 * repository from the ZudoJS container.
 *
 * There is no command side yet. Settling a bet means reading a completed
 * match result, deciding each selection against it and calculating a
 * payout — the algorithm this phase deliberately does not implement.
 * Registering an empty command bus would claim a capability that does not
 * exist. See `docs/architecture.md` for the ordering this service depends
 * on: a result exists before settlement runs, never the other way round.
 */

import type { Container } from "@zudojs/container";
import type { QueryBus } from "@zudojs/cqrs";
import {
  SETTLEMENT_QUERY,
  SETTLEMENT_REPOSITORY_TOKEN,
} from "../../constants/index.js";
import {
  GetSettlementHandler,
  ListSettlementsHandler,
} from "./queries/index.js";

export interface SettlementServiceConfig {
  readonly container: Container;
  readonly queryBus: QueryBus;
}

export function registerSettlementService(
  config: SettlementServiceConfig,
): void {
  const { container, queryBus } = config;

  const settlements = container.resolve(SETTLEMENT_REPOSITORY_TOKEN);

  queryBus.register(
    SETTLEMENT_QUERY.GET_SETTLEMENT,
    new GetSettlementHandler(settlements),
  );
  queryBus.register(
    SETTLEMENT_QUERY.LIST_SETTLEMENTS,
    new ListSettlementsHandler(settlements),
  );
}
