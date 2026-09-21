import {
  AUDIT_RECORDER_TOKEN,
  COMMISSION_REPOSITORY_TOKEN,
  PLATFORM_READER_TOKEN,
  SETTLEMENT_COMMAND,
  SETTLEMENT_QUERY,
} from "../../constants/index.js";
import type { ServiceRegistration } from "../settlement/index.js";
import { UpdateCommissionConfigHandler } from "./commands/index.js";
import { GetCommissionConfigHandler, ListCommissionHandler } from "./queries/index.js";

export function registerCommissionService(config: ServiceRegistration): void {
  const { container, commandBus, queryBus } = config;

  const commission = container.resolve(COMMISSION_REPOSITORY_TOKEN);
  const platform = container.resolve(PLATFORM_READER_TOKEN);

  commandBus.register(
    SETTLEMENT_COMMAND.UPDATE_COMMISSION_CONFIG,
    new UpdateCommissionConfigHandler(commission, platform, container.resolve(AUDIT_RECORDER_TOKEN)),
  );

  queryBus.register(SETTLEMENT_QUERY.GET_COMMISSION_CONFIG, new GetCommissionConfigHandler(commission));
  queryBus.register(SETTLEMENT_QUERY.LIST_COMMISSION, new ListCommissionHandler(commission, platform));
}
