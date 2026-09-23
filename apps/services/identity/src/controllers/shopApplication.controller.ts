import { ErrorCodes } from "@betng/contracts";
import type {
  AdminShopApplication,
  Cashier,
  CashierCredentials,
  ShopApplicationReceipt,
  ShopApplicationStatusView,
} from "@betng/contracts";
import { forbidden, getRequestId, parseBody, parseQuery, requireActor, requireParam } from "@betng/service-kit";
import type { HttpRouterContext } from "@betng/service-kit";
import { validate } from "@zudojs/validation";
import { ADMIN_PERMISSION, SHOP_PERMISSION } from "../constants/index.js";
import type { ListDto } from "../dtos/index.js";
import { InvalidInputError } from "../errors/index.js";
import type { ShopActor } from "../interfaces/index.js";
import type { IdentityBuses } from "../loaders/index.js";
import {
  CreateShopCashierCommand,
  GetShopApplicationQuery,
  GetShopApplicationStatusQuery,
  ListShopApplicationsQuery,
  ResetShopCashierCredentialsCommand,
  ReviewShopApplicationCommand,
  SetShopCashierStatusCommand,
  SubmitShopApplicationCommand,
  VerifyShopApplicationEmailCommand,
} from "../services/index.js";
import type { ShopApplicationReviewResult } from "../services/index.js";
import {
  applicationReferenceValidator,
  createCashierValidator,
  shopApplicationDecisionValidator,
  shopApplicationQueueQueryValidator,
  shopApplicationStatusQueryValidator,
  shopApplicationValidator,
  shopApplicationVerifyValidator,
  statusChangeValidator,
} from "../validators/index.js";
import { requireAdmin, uuidParam } from "./request.helper.js";

export interface ShopApplicationController {
  readonly submit: (context: HttpRouterContext) => Promise<ShopApplicationReceipt>;
  readonly verifyEmail: (context: HttpRouterContext) => Promise<ShopApplicationStatusView>;
  readonly status: (context: HttpRouterContext) => Promise<ShopApplicationStatusView>;
  readonly queue: (context: HttpRouterContext) => Promise<ListDto<AdminShopApplication>>;
  readonly get: (context: HttpRouterContext) => Promise<AdminShopApplication>;
  readonly review: (context: HttpRouterContext) => Promise<ShopApplicationReviewResult>;
  readonly createCashier: (context: HttpRouterContext) => Promise<CashierCredentials>;
  readonly setCashierStatus: (context: HttpRouterContext) => Promise<Cashier>;
  readonly resetCashierCredentials: (context: HttpRouterContext) => Promise<CashierCredentials>;
}

/** The reference is a path segment, so it is shape-checked before it reaches a query. */
function reference(context: HttpRouterContext): string {
  const result = validate(applicationReferenceValidator, requireParam(context.params, "reference"));

  if (!result.success) {
    throw new InvalidInputError("reference", "That is not a valid application reference.");
  }

  return result.data;
}

/**
 * The shop always comes from the session, never from the request — an owner cannot name another shop in a
 * path or a body.
 */
function shopActor(context: HttpRouterContext, permission: string): ShopActor {
  const actor = requireActor(context.request, { kind: "CASHIER", permission });

  if (actor.shopId === undefined) {
    throw forbidden("You do not have permission to do this.", { code: ErrorCodes.FORBIDDEN, expose: true });
  }

  return {
    id: actor.id,
    shopId: actor.shopId,
    role: actor.role as ShopActor["role"],
    name: actor.name === "" ? actor.id : actor.name,
    requestId: getRequestId(context.request),
  };
}

export function createShopApplicationController(buses: IdentityBuses): ShopApplicationController {
  const { commandBus, queryBus } = buses;

  return {
    submit: async (context) =>
      commandBus.execute<SubmitShopApplicationCommand, ShopApplicationReceipt>(
        new SubmitShopApplicationCommand({
          request: parseBody(context.request, shopApplicationValidator),
          requestId: getRequestId(context.request),
        }),
      ),

    verifyEmail: async (context) =>
      commandBus.execute<VerifyShopApplicationEmailCommand, ShopApplicationStatusView>(
        new VerifyShopApplicationEmailCommand({
          reference: reference(context),
          request: parseBody(context.request, shopApplicationVerifyValidator),
          requestId: getRequestId(context.request),
        }),
      ),

    status: async (context) => {
      const { email } = parseQuery(context.query, shopApplicationStatusQueryValidator);

      return queryBus.execute<GetShopApplicationStatusQuery, ShopApplicationStatusView>(
        new GetShopApplicationStatusQuery({ reference: reference(context), applicantEmail: email }),
      );
    },

    queue: async (context) => {
      requireAdmin(context, ADMIN_PERMISSION.SHOP_APPLICATIONS_READ);

      const { status } = parseQuery(context.query, shopApplicationQueueQueryValidator);

      return {
        items: await queryBus.execute<ListShopApplicationsQuery, readonly AdminShopApplication[]>(
          new ListShopApplicationsQuery(status),
        ),
      };
    },

    get: async (context) => {
      requireAdmin(context, ADMIN_PERMISSION.SHOP_APPLICATIONS_READ);

      return queryBus.execute<GetShopApplicationQuery, AdminShopApplication>(
        new GetShopApplicationQuery(uuidParam(context, "id")),
      );
    },

    review: async (context) =>
      commandBus.execute<ReviewShopApplicationCommand, ShopApplicationReviewResult>(
        new ReviewShopApplicationCommand({
          actor: requireAdmin(context, ADMIN_PERMISSION.SHOP_APPLICATIONS_WRITE),
          applicationId: uuidParam(context, "id"),
          decision: parseBody(context.request, shopApplicationDecisionValidator),
        }),
      ),

    createCashier: async (context) =>
      commandBus.execute<CreateShopCashierCommand, CashierCredentials>(
        new CreateShopCashierCommand({
          actor: shopActor(context, SHOP_PERMISSION.CASHIERS_WRITE),
          request: parseBody(context.request, createCashierValidator),
        }),
      ),

    setCashierStatus: async (context) => {
      const actor = shopActor(context, SHOP_PERMISSION.CASHIERS_WRITE);
      const { status, reason } = parseBody(context.request, statusChangeValidator);

      return commandBus.execute<SetShopCashierStatusCommand, Cashier>(
        new SetShopCashierStatusCommand({ actor, cashierId: uuidParam(context, "id"), status, reason }),
      );
    },

    resetCashierCredentials: async (context) =>
      commandBus.execute<ResetShopCashierCredentialsCommand, CashierCredentials>(
        new ResetShopCashierCredentialsCommand({
          actor: shopActor(context, SHOP_PERMISSION.CASHIERS_WRITE),
          cashierId: uuidParam(context, "id"),
        }),
      ),
  };
}
