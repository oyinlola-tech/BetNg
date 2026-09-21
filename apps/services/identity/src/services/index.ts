import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HandlerDependencies } from "../interfaces/index.js";
import { LoginAdminHandler, GetAdminSessionHandler } from "./adminAuth/index.js";
import {
  CreateCashierHandler,
  CreateShopHandler,
  GetShopHandler,
  ListShopCashiersHandler,
  ListShopsHandler,
  ResetCashierCredentialsHandler,
  SetCashierStatusHandler,
  SetShopStatusHandler,
  UpdateShopHandler,
} from "./adminShops/index.js";
import { ListCustomersHandler, SetCustomerStatusHandler } from "./adminUsers/index.js";
import { ListAuditLogsHandler, RecordAuditHandler } from "./audit/index.js";
import {
  GetCustomerProfileHandler,
  LoginCustomerHandler,
  RegisterCustomerHandler,
  RequestPasswordResetHandler,
  ResendVerificationHandler,
  VerifyEmailHandler,
} from "./customerAuth/index.js";
import { AuthenticateHandler, LogoutHandler } from "./session/index.js";
import { GetSettingsHandler, UpdateSettingsHandler } from "./settings/index.js";
import {
  GetShopSessionHandler,
  ListOwnShopCashiersHandler,
  LoginCashierHandler,
  VerifyCashierPinHandler,
} from "./shopAuth/index.js";

export interface IdentityServiceConfig {
  readonly dependencies: HandlerDependencies;
  readonly commandBus: CommandBus;
  readonly queryBus: QueryBus;
}

export function registerIdentityServices(config: IdentityServiceConfig): void {
  const { dependencies: deps, commandBus, queryBus } = config;

  const commands = [
    new RegisterCustomerHandler(deps),
    new VerifyEmailHandler(deps),
    new ResendVerificationHandler(deps),
    new LoginCustomerHandler(deps),
    new RequestPasswordResetHandler(deps),
    new LoginCashierHandler(deps),
    new VerifyCashierPinHandler(deps),
    new LoginAdminHandler(deps),
    new AuthenticateHandler(deps),
    new LogoutHandler(deps),
    new SetCustomerStatusHandler(deps),
    new CreateShopHandler(deps),
    new UpdateShopHandler(deps),
    new SetShopStatusHandler(deps),
    new CreateCashierHandler(deps),
    new SetCashierStatusHandler(deps),
    new ResetCashierCredentialsHandler(deps),
    new RecordAuditHandler(deps),
    new UpdateSettingsHandler(deps),
  ];

  const queries = [
    new GetCustomerProfileHandler(deps),
    new GetShopSessionHandler(deps),
    new ListOwnShopCashiersHandler(deps),
    new GetAdminSessionHandler(deps),
    new ListCustomersHandler(deps),
    new ListShopsHandler(deps),
    new GetShopHandler(deps),
    new ListShopCashiersHandler(deps),
    new ListAuditLogsHandler(deps),
    new GetSettingsHandler(deps),
  ];

  for (const handler of commands) {
    commandBus.register(handler.commandType, handler);
  }

  for (const handler of queries) {
    queryBus.register(handler.queryType, handler);
  }
}

export * from "./adminAuth/index.js";
export * from "./adminShops/index.js";
export * from "./adminUsers/index.js";
export * from "./audit/index.js";
export * from "./customerAuth/index.js";
export * from "./session/index.js";
export * from "./settings/index.js";
export * from "./shopAuth/index.js";
