import { ErrorCodes } from "@betng/contracts";
import type { Cashier, ShopSession } from "@betng/contracts";
import { forbidden, getRequestId, parseBody, requireActor } from "@betng/service-kit";
import type { HttpRouterContext } from "@betng/service-kit";
import { SHOP_PERMISSION } from "../constants/index.js";
import type { ListDto } from "../dtos/index.js";
import type { IdentityBuses } from "../loaders/index.js";
import {
  GetShopSessionQuery,
  ListOwnShopCashiersQuery,
  LoginCashierCommand,
  LogoutCommand,
} from "../services/index.js";
import { readBearerToken } from "../utils/index.js";
import { loginCashierValidator } from "../validators/index.js";

export interface ShopController {
  login(context: HttpRouterContext): Promise<ShopSession>;
  logout(context: HttpRouterContext): Promise<void>;
  session(context: HttpRouterContext): Promise<ShopSession>;
  listCashiers(context: HttpRouterContext): Promise<ListDto<Cashier>>;
}

export function createShopController(buses: IdentityBuses): ShopController {
  const { commandBus, queryBus } = buses;

  return {
    login: async (context) =>
      commandBus.execute<LoginCashierCommand, ShopSession>(
        new LoginCashierCommand(parseBody(context.request, loginCashierValidator)),
      ),

    logout: async (context) =>
      commandBus.execute<LogoutCommand>(
        new LogoutCommand(readBearerToken(context.request), "CASHIER", getRequestId(context.request)),
      ),

    session: async (context) =>
      queryBus.execute<GetShopSessionQuery, ShopSession>(
        new GetShopSessionQuery(readBearerToken(context.request)),
      ),

    listCashiers: async (context) => {
      const actor = requireActor(context.request, {
        kind: "CASHIER",
        permission: SHOP_PERMISSION.CASHIERS_READ,
      });

      if (actor.shopId === undefined) {
        throw forbidden("You do not have permission to do this.", {
          code: ErrorCodes.FORBIDDEN,
          expose: true,
        });
      }

      // The shop comes from the actor, never from the request: a cashier sees their own shop only.
      return {
        items: await queryBus.execute<ListOwnShopCashiersQuery, readonly Cashier[]>(
          new ListOwnShopCashiersQuery(actor.shopId),
        ),
      };
    },
  };
}
