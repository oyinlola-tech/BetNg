import type { Command, CommandBus, CommandHandler, Query, QueryBus, QueryHandler } from "@zudojs/cqrs";
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
import {
  ListNotificationsHandler,
  MarkNotificationsReadHandler,
  NotifyCustomerHandler,
} from "./notifications/index.js";
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

  const command = <C extends Command, R>(handler: CommandHandler<C, R>): void => {
    commandBus.register(handler.commandType, handler);
  };

  const query = <Q extends Query, R>(handler: QueryHandler<Q, R>): void => {
    queryBus.register(handler.queryType, handler);
  };

  command(new RegisterCustomerHandler(deps));
  command(new VerifyEmailHandler(deps));
  command(new ResendVerificationHandler(deps));
  command(new LoginCustomerHandler(deps));
  command(new RequestPasswordResetHandler(deps));
  command(new LoginCashierHandler(deps));
  command(new VerifyCashierPinHandler(deps));
  command(new LoginAdminHandler(deps));
  command(new AuthenticateHandler(deps));
  command(new LogoutHandler(deps));
  command(new SetCustomerStatusHandler(deps));
  command(new CreateShopHandler(deps));
  command(new UpdateShopHandler(deps));
  command(new SetShopStatusHandler(deps));
  command(new CreateCashierHandler(deps));
  command(new SetCashierStatusHandler(deps));
  command(new ResetCashierCredentialsHandler(deps));
  command(new RecordAuditHandler(deps));
  command(new UpdateSettingsHandler(deps));
  command(new NotifyCustomerHandler(deps));
  command(new MarkNotificationsReadHandler(deps));

  query(new GetCustomerProfileHandler(deps));
  query(new GetShopSessionHandler(deps));
  query(new ListOwnShopCashiersHandler(deps));
  query(new GetAdminSessionHandler(deps));
  query(new ListCustomersHandler(deps));
  query(new ListShopsHandler(deps));
  query(new GetShopHandler(deps));
  query(new ListShopCashiersHandler(deps));
  query(new ListAuditLogsHandler(deps));
  query(new GetSettingsHandler(deps));
  query(new ListNotificationsHandler(deps));
}

export * from "./adminAuth/index.js";
export * from "./adminShops/index.js";
export * from "./adminUsers/index.js";
export * from "./audit/index.js";
export * from "./customerAuth/index.js";
export * from "./notifications/index.js";
export * from "./session/index.js";
export * from "./settings/index.js";
export * from "./shopAuth/index.js";
