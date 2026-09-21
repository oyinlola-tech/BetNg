import type { Container } from "@zudojs/container";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import {
  EFFECTS_APPLIER_TOKEN,
  LOGGER_TOKEN,
  MATCH_SETTLER_TOKEN,
  SETTLEMENT_COMMAND,
  SETTLEMENT_QUERY,
  SETTLEMENT_REPOSITORY_TOKEN,
} from "../../constants/index.js";
import {
  RetryEffectsHandler,
  RetrySettlementHandler,
  SettleMatchHandler,
  VoidMatchHandler,
} from "./commands/index.js";
import {
  GetSettlementHandler,
  ListAdminSettlementsHandler,
  ListSettlementsHandler,
} from "./queries/index.js";

export { customerCreditFor, EffectsApplier } from "./effects.applier.js";
export type { EffectsApplierDependencies } from "./effects.applier.js";
export { MatchSettler } from "./match.settler.js";
export type {
  MatchSettlementResult,
  MatchSettlerDependencies,
  SettleMatchInput,
} from "./match.settler.js";

export interface ServiceRegistration {
  readonly container: Container;
  readonly commandBus: CommandBus;
  readonly queryBus: QueryBus;
}

export function registerSettlementService(config: ServiceRegistration): void {
  const { container, commandBus, queryBus } = config;

  const settlements = container.resolve(SETTLEMENT_REPOSITORY_TOKEN);
  const settler = container.resolve(MATCH_SETTLER_TOKEN);

  commandBus.register(SETTLEMENT_COMMAND.SETTLE_MATCH, new SettleMatchHandler(settler));
  commandBus.register(SETTLEMENT_COMMAND.VOID_MATCH, new VoidMatchHandler(settler));
  commandBus.register(
    SETTLEMENT_COMMAND.RETRY_SETTLEMENT,
    new RetrySettlementHandler(settlements, settler),
  );
  commandBus.register(
    SETTLEMENT_COMMAND.RETRY_EFFECTS,
    new RetryEffectsHandler(
      settlements,
      container.resolve(EFFECTS_APPLIER_TOKEN),
      settler,
      container.resolve(LOGGER_TOKEN),
    ),
  );

  queryBus.register(SETTLEMENT_QUERY.GET_SETTLEMENT, new GetSettlementHandler(settlements));
  queryBus.register(SETTLEMENT_QUERY.LIST_SETTLEMENTS, new ListSettlementsHandler(settlements));
  queryBus.register(
    SETTLEMENT_QUERY.LIST_ADMIN_SETTLEMENTS,
    new ListAdminSettlementsHandler(settlements),
  );
}
