import type { LimitHistoryEntry, LimitsSummary, SelfExclusion } from "@betng/contracts";
import { ErrorCodes } from "@betng/contracts";
import { parseBody, requireParam, unprocessableEntity } from "@betng/service-kit";
import type { HttpRouterContext } from "@betng/service-kit";
import { validate } from "@zudojs/validation";
import type { ListDto } from "../dtos/index.js";
import type { IdentityBuses } from "../loaders/index.js";
import {
  CancelSelfExclusionCommand,
  GetLimitsSummaryQuery,
  ListLimitHistoryQuery,
  RemoveLimitCommand,
  SelfExcludeCommand,
  SetLimitCommand,
} from "../services/index.js";
import { limitKindParamValidator, selfExcludeValidator, setLimitValidator } from "../validators/index.js";
import { customerCaller } from "./request.helper.js";

export interface LimitsController {
  readonly summary: (context: HttpRouterContext) => Promise<LimitsSummary>;
  readonly setLimit: (context: HttpRouterContext) => Promise<LimitsSummary>;
  readonly removeLimit: (context: HttpRouterContext) => Promise<LimitsSummary>;
  readonly selfExclude: (context: HttpRouterContext) => Promise<SelfExclusion>;
  readonly cancelSelfExclusion: (context: HttpRouterContext) => Promise<SelfExclusion>;
  readonly history: (context: HttpRouterContext) => Promise<ListDto<LimitHistoryEntry>>;
}

export function createLimitsController(buses: IdentityBuses): LimitsController {
  const { commandBus, queryBus } = buses;

  return {
    summary: async (context) => queryBus.execute<GetLimitsSummaryQuery, LimitsSummary>(new GetLimitsSummaryQuery(customerCaller(context))),

    setLimit: async (context) => {
      const { kind, value } = parseBody(context.request, setLimitValidator);

      return commandBus.execute<SetLimitCommand, LimitsSummary>(new SetLimitCommand(customerCaller(context), kind, value));
    },

    removeLimit: async (context) => {
      const kind = validate(limitKindParamValidator, requireParam(context.params, "kind"));

      if (!kind.success) {
        throw unprocessableEntity("The path failed validation.", {
          code: ErrorCodes.VALIDATION_FAILED,
          details: [{ path: "kind", message: "Unknown limit." }],
        });
      }

      return commandBus.execute<RemoveLimitCommand, LimitsSummary>(new RemoveLimitCommand(customerCaller(context), kind.data));
    },

    selfExclude: async (context) =>
      commandBus.execute<SelfExcludeCommand, SelfExclusion>(
        new SelfExcludeCommand(customerCaller(context), parseBody(context.request, selfExcludeValidator)),
      ),

    cancelSelfExclusion: async (context) =>
      commandBus.execute<CancelSelfExclusionCommand, SelfExclusion>(new CancelSelfExclusionCommand(customerCaller(context))),

    history: async (context) => ({
      items: await queryBus.execute<ListLimitHistoryQuery, readonly LimitHistoryEntry[]>(new ListLimitHistoryQuery(customerCaller(context))),
    }),
  };
}
