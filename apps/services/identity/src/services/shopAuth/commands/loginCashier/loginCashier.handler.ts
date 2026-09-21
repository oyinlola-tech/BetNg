import { CommandHandler } from "@zudojs/cqrs";
import type { ShopSession } from "@betng/contracts";
import { IDENTITY_COMMAND, SHOP_ROLE_PERMISSIONS } from "../../../../constants/index.js";
import { toCashier, toShop } from "../../../../dtos/index.js";
import { AccountSuspendedError, InvalidCredentialsError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { normaliseShopCode, normaliseUsername } from "../../../../utils/index.js";
import { throttleKey } from "../../../security/index.js";
import type { LoginCashierCommand } from "./loginCashier.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "readModel" | "hasher" | "sessions" | "throttle">;

export class LoginCashierHandler extends CommandHandler<LoginCashierCommand, ShopSession> {
  public readonly commandType = IDENTITY_COMMAND.LOGIN_CASHIER;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: LoginCashierCommand): Promise<ShopSession> {
    const { store, readModel, hasher, sessions, throttle } = this.deps;
    const { password, pin } = command.request;
    const shopCode = normaliseShopCode(command.request.shopCode);
    const username = normaliseUsername(command.request.username);
    const key = throttleKey.cashier(shopCode, username);

    await throttle.assertNotLocked(key);

    const shop = await store.shops.findByCode(shopCode);
    const cashier =
      shop === undefined ? undefined : await store.cashiers.findByShopAndUsername(shop.id, username);

    // The same hashing work is done whether or not the shop and cashier exist.
    let proven: boolean;

    if (shop === undefined || cashier === undefined) {
      await hasher.verifyAgainstNothing(password);

      if (pin !== undefined) {
        await hasher.verifyAgainstNothing(pin);
      }

      proven = false;
    } else {
      const passwordOk = await hasher.verify(password, cashier.passwordHash);
      const pinOk = pin === undefined || (await hasher.verify(pin, cashier.pinHash));
      const unexpired =
        cashier.credentialsExpireAt === null || cashier.credentialsExpireAt > new Date();

      proven = passwordOk && pinOk && unexpired;
    }

    if (!proven || shop === undefined || cashier === undefined) {
      await throttle.recordFailure(key);
      throw new InvalidCredentialsError();
    }

    await throttle.clear(key);

    if (cashier.status !== "ACTIVE") {
      throw new AccountSuspendedError();
    }

    if (shop.status === "SUSPENDED") {
      throw new AccountSuspendedError("This shop has been suspended.");
    }

    const balance = await readModel.shopBalance(shop.id);

    const issued = await store.transaction(async (repositories) => {
      await repositories.cashiers.markCredentialsUsed(cashier.id);

      return sessions.issue(repositories, "CASHIER", cashier.id);
    });

    return {
      token: issued.token,
      expiresAt: issued.session.expiresAt.toISOString(),
      shop: toShop(shop, balance),
      cashier: toCashier(cashier),
      permissions: SHOP_ROLE_PERMISSIONS[cashier.role],
    };
  }
}
