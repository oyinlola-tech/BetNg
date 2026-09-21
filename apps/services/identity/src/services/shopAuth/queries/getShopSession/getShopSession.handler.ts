import { QueryHandler } from "@zudojs/cqrs";
import type { ShopSession } from "@betng/contracts";
import { IDENTITY_QUERY, SHOP_ROLE_PERMISSIONS } from "../../../../constants/index.js";
import { toCashier, toShop } from "../../../../dtos/index.js";
import { UnauthenticatedError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import type { GetShopSessionQuery } from "./getShopSession.query.js";

type Dependencies = Pick<HandlerDependencies, "resolver" | "readModel">;

export class GetShopSessionHandler extends QueryHandler<GetShopSessionQuery, ShopSession> {
  public readonly queryType = IDENTITY_QUERY.GET_SHOP_SESSION;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: GetShopSessionQuery): Promise<ShopSession> {
    if (query.token === undefined) {
      throw new UnauthenticatedError();
    }

    const resolved = await this.deps.resolver.resolveAs(query.token, "CASHIER");
    const balance = await this.deps.readModel.shopBalance(resolved.shop.id);

    return {
      token: query.token,
      expiresAt: resolved.session.expiresAt.toISOString(),
      shop: toShop(resolved.shop, balance),
      cashier: toCashier(resolved.cashier),
      permissions: SHOP_ROLE_PERMISSIONS[resolved.cashier.role],
    };
  }
}
