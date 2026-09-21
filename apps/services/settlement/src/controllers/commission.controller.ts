import { parseBody, parseQuery, requireActor } from "@betng/service-kit";
import type { HttpRouterContext } from "@betng/service-kit";
import type { CommissionConfig } from "@betng/contracts";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import { LIST_LIMIT, SETTLEMENT_PERMISSION } from "../constants/index.js";
import { toCommissionConfigDto, toCommissionSummaryDto } from "../dtos/index.js";
import type { CommissionConfigDto, CommissionListDto } from "../dtos/index.js";
import type { CommissionConfigRecord } from "../models/index.js";
import { UpdateCommissionConfigCommand } from "../services/commission/commands/index.js";
import {
  GetCommissionConfigQuery,
  ListCommissionQuery,
} from "../services/commission/queries/index.js";
import type {
  CurrentCommissionConfig,
  NamedCommission,
} from "../services/commission/queries/index.js";
import { listCommissionQuerySchema, updateCommissionConfigBodySchema } from "../validators/index.js";
import { toAuditActor } from "./request.helper.js";

export interface CommissionController {
  listCommission(context: HttpRouterContext): Promise<CommissionListDto>;
  getConfig(context: HttpRouterContext): Promise<CommissionConfigDto>;
  updateConfig(context: HttpRouterContext): Promise<CommissionConfig>;
}

export function createCommissionController(
  commandBus: CommandBus,
  queryBus: QueryBus,
): CommissionController {
  return {
    listCommission: async (context) => {
      requireActor(context.request, { kind: "ADMIN", permission: SETTLEMENT_PERMISSION.READ });

      const query = parseQuery(context.query, listCommissionQuerySchema);

      const rows = await queryBus.execute<ListCommissionQuery, readonly NamedCommission[]>(
        new ListCommissionQuery({
          ...(query.periodId === undefined ? {} : { periodId: query.periodId }),
          limit: query.limit ?? LIST_LIMIT.COMMISSION_DEFAULT,
        }),
      );

      return { items: rows.map((row) => toCommissionSummaryDto(row.record, row.shopName)) };
    },

    getConfig: async (context) => {
      requireActor(context.request, { kind: "ADMIN", permission: SETTLEMENT_PERMISSION.READ });

      const current = await queryBus.execute<GetCommissionConfigQuery, CurrentCommissionConfig>(
        new GetCommissionConfigQuery(),
      );

      return {
        default: toCommissionConfigDto(current.platformDefault),
        shops: current.shops.map(toCommissionConfigDto),
      };
    },

    updateConfig: async (context) => {
      const actor = requireActor(context.request, {
        kind: "ADMIN",
        permission: SETTLEMENT_PERMISSION.OPERATE,
      });

      const body = parseBody(context.request, updateCommissionConfigBodySchema);

      return toCommissionConfigDto(
        await commandBus.execute<UpdateCommissionConfigCommand, CommissionConfigRecord>(
          new UpdateCommissionConfigCommand({
            ...(body.shopId === undefined ? {} : { shopId: body.shopId }),
            shopSharePercent: body.shopSharePercent,
            reason: body.reason,
            actor: toAuditActor(actor, context),
          }),
        ),
      );
    },
  };
}
