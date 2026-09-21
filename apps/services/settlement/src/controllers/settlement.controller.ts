/**
 * No handler here accepts an outcome, a payout or a result: settlement is recalculated from the recorded
 * result and the odds stored on the bet, whoever asks.
 */

import {
  forbidden,
  getRequestId,
  isInternalRequest,
  notFound,
  parseBody,
  parseQuery,
  requireActor,
} from "@betng/service-kit";
import type { HttpRouterContext } from "@betng/service-kit";
import { ErrorCodes } from "@betng/contracts";
import type { AdminSettlement, MatchSettlement, Settlement } from "@betng/contracts";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import { LIST_LIMIT, SETTLEMENT_PERMISSION, SYSTEM_ACTOR } from "../constants/index.js";
import { toAdminSettlementDto, toSettlementDto } from "../dtos/index.js";
import type { AdminSettlementListDto, SettlementListDto } from "../dtos/index.js";
import type { AdminSettlementRecord, SettlementRecord } from "../models/index.js";
import type { MatchSettlementResult } from "../services/index.js";
import { RetrySettlementCommand, SettleMatchCommand } from "../services/settlement/commands/index.js";
import {
  GetSettlementQuery,
  ListAdminSettlementsQuery,
  ListSettlementsQuery,
} from "../services/settlement/queries/index.js";
import {
  betIdParamSchema,
  listAdminSettlementsQuerySchema,
  listSettlementsQuerySchema,
  matchIdParamSchema,
  retrySettlementBodySchema,
} from "../validators/index.js";
import { parseParam, toAuditActor } from "./request.helper.js";

export interface SettlementController {
  getSettlement(context: HttpRouterContext): Promise<Settlement>;
  listSettlements(context: HttpRouterContext): Promise<SettlementListDto>;
  listAdminSettlements(context: HttpRouterContext): Promise<AdminSettlementListDto>;
  retrySettlement(context: HttpRouterContext): Promise<AdminSettlement>;
  settleMatchInternally(context: HttpRouterContext): Promise<MatchSettlement>;
}

/** A customer is scoped to their own bets; an admin needs `settlement:read`; nobody else may read. */
function readerScope(context: HttpRouterContext): string | undefined {
  const actor = requireActor(context.request, { kind: ["CUSTOMER", "ADMIN"] });

  if (actor.kind === "CUSTOMER") {
    return actor.id;
  }

  if (!actor.permissions.includes(SETTLEMENT_PERMISSION.READ)) {
    throw forbidden("You do not have permission to do this.", {
      code: ErrorCodes.FORBIDDEN,
      expose: true,
    });
  }

  return undefined;
}

export function createSettlementController(
  commandBus: CommandBus,
  queryBus: QueryBus,
): SettlementController {
  return {
    getSettlement: async (context) => {
      const userId = readerScope(context);
      const betId = parseParam(context, "betId", betIdParamSchema);

      return toSettlementDto(
        await queryBus.execute<GetSettlementQuery, SettlementRecord>(
          new GetSettlementQuery(betId, userId),
        ),
      );
    },

    listSettlements: async (context) => {
      const userId = readerScope(context);
      const query = parseQuery(context.query, listSettlementsQuerySchema);

      const records = await queryBus.execute<ListSettlementsQuery, readonly SettlementRecord[]>(
        new ListSettlementsQuery({
          ...(userId === undefined ? {} : { userId }),
          ...(query.status === undefined ? {} : { outcome: query.status }),
          ...(query.matchId === undefined ? {} : { matchId: query.matchId }),
          limit: query.limit ?? LIST_LIMIT.SETTLEMENTS_DEFAULT,
        }),
      );

      return { items: records.map(toSettlementDto) };
    },

    listAdminSettlements: async (context) => {
      requireActor(context.request, { kind: "ADMIN", permission: SETTLEMENT_PERMISSION.READ });

      const query = parseQuery(context.query, listAdminSettlementsQuerySchema);

      const records = await queryBus.execute<
        ListAdminSettlementsQuery,
        readonly AdminSettlementRecord[]
      >(
        new ListAdminSettlementsQuery({
          ...(query.status === undefined ? {} : { status: query.status }),
          limit: query.limit ?? LIST_LIMIT.ADMIN_SETTLEMENTS_DEFAULT,
        }),
      );

      return { items: records.map(toAdminSettlementDto) };
    },

    retrySettlement: async (context) => {
      const actor = requireActor(context.request, {
        kind: "ADMIN",
        permission: SETTLEMENT_PERMISSION.OPERATE,
      });

      const betId = parseParam(context, "id", betIdParamSchema);
      const body = parseBody(context.request, retrySettlementBodySchema);

      return toAdminSettlementDto(
        await commandBus.execute<RetrySettlementCommand, AdminSettlementRecord>(
          new RetrySettlementCommand({
            betId,
            reason: body.reason,
            actor: toAuditActor(actor, context),
          }),
        ),
      );
    },

    settleMatchInternally: async (context) => {
      // Service-to-service only; to anyone without the internal token the route does not exist.
      if (!isInternalRequest(context.request)) {
        throw notFound("Not found.", { code: ErrorCodes.NOT_FOUND, expose: true });
      }

      const matchId = parseParam(context, "id", matchIdParamSchema);

      return commandBus.execute<SettleMatchCommand, MatchSettlementResult>(
        new SettleMatchCommand({
          matchId,
          actor: { ...SYSTEM_ACTOR, requestId: getRequestId(context.request) },
        }),
      );
    },
  };
}
