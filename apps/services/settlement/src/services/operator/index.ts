import {
  AUDIT_RECORDER_TOKEN,
  LOGGER_TOKEN,
  OPERATOR_REPOSITORY_TOKEN,
  SETTLEMENT_COMMAND,
  SETTLEMENT_QUERY,
} from "../../constants/index.js";
import type { ServiceRegistration } from "../settlement/index.js";
import { ClosePeriodHandler, RollOverPeriodHandler } from "./commands/index.js";
import { PeriodCloseAuditor } from "./periodClose.auditor.js";
import { GetOperatorOverviewHandler, ListOperatorPeriodsHandler } from "./queries/index.js";

export function registerOperatorService(config: ServiceRegistration): void {
  const { container, commandBus, queryBus } = config;

  const operator = container.resolve(OPERATOR_REPOSITORY_TOKEN);
  const auditor = new PeriodCloseAuditor(
    container.resolve(AUDIT_RECORDER_TOKEN),
    container.resolve(LOGGER_TOKEN),
  );

  commandBus.register(SETTLEMENT_COMMAND.CLOSE_PERIOD, new ClosePeriodHandler(operator, auditor));
  commandBus.register(SETTLEMENT_COMMAND.ROLL_OVER_PERIOD, new RollOverPeriodHandler(operator, auditor));

  queryBus.register(SETTLEMENT_QUERY.GET_OPERATOR_OVERVIEW, new GetOperatorOverviewHandler(operator));
  queryBus.register(SETTLEMENT_QUERY.LIST_OPERATOR_PERIODS, new ListOperatorPeriodsHandler(operator));
}
