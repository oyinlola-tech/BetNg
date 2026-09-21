import { parseBody, parseQuery, requireActor } from "@betng/service-kit";
import type { HttpRouterContext } from "@betng/service-kit";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import { LIST_LIMIT, SETTLEMENT_PERMISSION } from "../constants/index.js";
import { toOperatorPeriodDto, toOperatorSummaryDto } from "../dtos/index.js";
import type { ClosePeriodDto, OperatorOverviewDto, OperatorPeriodListDto } from "../dtos/index.js";
import type { ClosedPeriodResult, OperatorPeriodRecord } from "../models/index.js";
import { ClosePeriodCommand } from "../services/operator/commands/index.js";
import {
  GetOperatorOverviewQuery,
  ListOperatorPeriodsQuery,
} from "../services/operator/queries/index.js";
import type { OperatorOverview } from "../services/operator/queries/index.js";
import { closePeriodBodySchema, listLimitQuerySchema } from "../validators/index.js";
import { toAuditActor } from "./request.helper.js";

export interface OperatorController {
  getOverview(context: HttpRouterContext): Promise<OperatorOverviewDto>;
  listPeriods(context: HttpRouterContext): Promise<OperatorPeriodListDto>;
  closePeriod(context: HttpRouterContext): Promise<ClosePeriodDto>;
}

export function createOperatorController(commandBus: CommandBus, queryBus: QueryBus): OperatorController {
  const overview = async (limit: number): Promise<OperatorOverview> =>
    queryBus.execute<GetOperatorOverviewQuery, OperatorOverview>(new GetOperatorOverviewQuery(limit));

  return {
    getOverview: async (context) => {
      requireActor(context.request, { kind: "ADMIN", permission: SETTLEMENT_PERMISSION.READ });

      const query = parseQuery(context.query, listLimitQuerySchema);
      const result = await overview(query.limit ?? LIST_LIMIT.PERIODS_DEFAULT);

      return {
        current: toOperatorSummaryDto(result.current),
        closed: result.closed.map(toOperatorSummaryDto),
      };
    },

    listPeriods: async (context) => {
      requireActor(context.request, { kind: "ADMIN", permission: SETTLEMENT_PERMISSION.READ });

      const query = parseQuery(context.query, listLimitQuerySchema);

      const periods = await queryBus.execute<ListOperatorPeriodsQuery, readonly OperatorPeriodRecord[]>(
        new ListOperatorPeriodsQuery(query.limit ?? LIST_LIMIT.PERIODS_DEFAULT),
      );

      return { items: periods.map(toOperatorPeriodDto) };
    },

    closePeriod: async (context) => {
      const actor = requireActor(context.request, {
        kind: "ADMIN",
        permission: SETTLEMENT_PERMISSION.OPERATE,
      });

      const body = parseBody(context.request, closePeriodBodySchema);

      const result = await commandBus.execute<ClosePeriodCommand, ClosedPeriodResult>(
        new ClosePeriodCommand({
          reason: body.reason,
          ...(body.kind === undefined ? {} : { nextKind: body.kind }),
          actor: toAuditActor(actor, context),
        }),
      );

      return {
        closed: toOperatorSummaryDto(result.closed),
        current: toOperatorSummaryDto((await overview(1)).current),
      };
    },
  };
}
