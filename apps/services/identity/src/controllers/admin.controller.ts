import type {
  AdminCashierSummary,
  AdminCustomer,
  AdminSession,
  AdminShopSummary,
  AuditLogEntry,
  CashierCredentials,
  Page,
  PlatformSettings,
} from "@betng/contracts";
import { getRequestId, parseBody, parseQuery } from "@betng/service-kit";
import type { HttpRouterContext } from "@betng/service-kit";
import { ADMIN_PERMISSION, LIST_LIMIT } from "../constants/index.js";
import type { ListDto } from "../dtos/index.js";
import type { IdentityBuses } from "../loaders/index.js";
import {
  CreateCashierCommand,
  CreateShopCommand,
  GetAdminSessionQuery,
  GetSettingsQuery,
  GetShopQuery,
  ListAuditLogsQuery,
  ListCustomersQuery,
  ListShopCashiersQuery,
  ListShopsQuery,
  LoginAdminCommand,
  LogoutCommand,
  ResetCashierCredentialsCommand,
  SetCashierStatusCommand,
  SetCustomerStatusCommand,
  SetShopStatusCommand,
  UpdateSettingsCommand,
  UpdateShopCommand,
} from "../services/index.js";
import { readBearerToken } from "../utils/index.js";
import {
  auditLogQueryValidator,
  createCashierValidator,
  createShopValidator,
  listCustomersQueryValidator,
  loginAdminValidator,
  statusChangeValidator,
  updateSettingsValidator,
  updateShopValidator,
} from "../validators/index.js";
import { requireAdmin, uuidParam } from "./request.helper.js";

export interface AdminController {
  readonly login: (context: HttpRouterContext) => Promise<AdminSession>;
  readonly logout: (context: HttpRouterContext) => Promise<void>;
  readonly session: (context: HttpRouterContext) => Promise<AdminSession>;
  readonly listCustomers: (context: HttpRouterContext) => Promise<ListDto<AdminCustomer>>;
  readonly setCustomerStatus: (context: HttpRouterContext) => Promise<AdminCustomer>;
  readonly listShops: (context: HttpRouterContext) => Promise<ListDto<AdminShopSummary>>;
  readonly getShop: (context: HttpRouterContext) => Promise<AdminShopSummary>;
  readonly createShop: (context: HttpRouterContext) => Promise<AdminShopSummary>;
  readonly updateShop: (context: HttpRouterContext) => Promise<AdminShopSummary>;
  readonly setShopStatus: (context: HttpRouterContext) => Promise<AdminShopSummary>;
  readonly listCashiers: (context: HttpRouterContext) => Promise<ListDto<AdminCashierSummary>>;
  readonly createCashier: (context: HttpRouterContext) => Promise<CashierCredentials>;
  readonly setCashierStatus: (context: HttpRouterContext) => Promise<AdminCashierSummary>;
  readonly resetCashierCredentials: (context: HttpRouterContext) => Promise<CashierCredentials>;
  readonly listAuditLogs: (context: HttpRouterContext) => Promise<Page<AuditLogEntry>>;
  readonly getSettings: (context: HttpRouterContext) => Promise<PlatformSettings>;
  readonly updateSettings: (context: HttpRouterContext) => Promise<PlatformSettings>;
}

export function createAdminController(buses: IdentityBuses): AdminController {
  const { commandBus, queryBus } = buses;

  return {
    login: async (context) =>
      commandBus.execute<LoginAdminCommand, AdminSession>(
        new LoginAdminCommand(
          parseBody(context.request, loginAdminValidator),
          getRequestId(context.request),
        ),
      ),

    logout: async (context) =>
      commandBus.execute<LogoutCommand>(
        new LogoutCommand(readBearerToken(context.request), "ADMIN", getRequestId(context.request)),
      ),

    session: async (context) =>
      queryBus.execute<GetAdminSessionQuery, AdminSession>(
        new GetAdminSessionQuery(readBearerToken(context.request)),
      ),

    listCustomers: async (context) => {
      requireAdmin(context, ADMIN_PERMISSION.USERS_READ);

      const { q } = parseQuery(context.query, listCustomersQueryValidator);

      return {
        items: await queryBus.execute<ListCustomersQuery, readonly AdminCustomer[]>(
          new ListCustomersQuery(q),
        ),
      };
    },

    setCustomerStatus: async (context) => {
      const actor = requireAdmin(context, ADMIN_PERMISSION.USERS_WRITE);
      const customerId = uuidParam(context, "id");
      const { status, reason } = parseBody(context.request, statusChangeValidator);

      return commandBus.execute<SetCustomerStatusCommand, AdminCustomer>(
        new SetCustomerStatusCommand({ actor, customerId, status, reason }),
      );
    },

    listShops: async (context) => {
      requireAdmin(context, ADMIN_PERMISSION.SHOPS_READ);

      return {
        items: await queryBus.execute<ListShopsQuery, readonly AdminShopSummary[]>(new ListShopsQuery()),
      };
    },

    getShop: async (context) => {
      requireAdmin(context, ADMIN_PERMISSION.SHOPS_READ);

      return queryBus.execute<GetShopQuery, AdminShopSummary>(new GetShopQuery(uuidParam(context, "id")));
    },

    createShop: async (context) => {
      const actor = requireAdmin(context, ADMIN_PERMISSION.SHOPS_WRITE);

      return commandBus.execute<CreateShopCommand, AdminShopSummary>(
        new CreateShopCommand(actor, parseBody(context.request, createShopValidator)),
      );
    },

    updateShop: async (context) => {
      const actor = requireAdmin(context, ADMIN_PERMISSION.SHOPS_WRITE);
      const shopId = uuidParam(context, "id");
      const { reason, ...changes } = parseBody(context.request, updateShopValidator);

      return commandBus.execute<UpdateShopCommand, AdminShopSummary>(
        new UpdateShopCommand({
          actor,
          shopId,
          changes: Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined)),
          reason,
        }),
      );
    },

    setShopStatus: async (context) => {
      const actor = requireAdmin(context, ADMIN_PERMISSION.SHOPS_WRITE);
      const shopId = uuidParam(context, "id");
      const { status, reason } = parseBody(context.request, statusChangeValidator);

      return commandBus.execute<SetShopStatusCommand, AdminShopSummary>(
        new SetShopStatusCommand({ actor, shopId, status, reason }),
      );
    },

    listCashiers: async (context) => {
      requireAdmin(context, ADMIN_PERMISSION.SHOPS_READ);

      return {
        items: await queryBus.execute<ListShopCashiersQuery, readonly AdminCashierSummary[]>(
          new ListShopCashiersQuery(uuidParam(context, "id")),
        ),
      };
    },

    createCashier: async (context) => {
      const actor = requireAdmin(context, ADMIN_PERMISSION.CASHIERS_WRITE);

      return commandBus.execute<CreateCashierCommand, CashierCredentials>(
        new CreateCashierCommand(
          actor,
          uuidParam(context, "id"),
          parseBody(context.request, createCashierValidator),
        ),
      );
    },

    setCashierStatus: async (context) => {
      const actor = requireAdmin(context, ADMIN_PERMISSION.CASHIERS_WRITE);
      const shopId = uuidParam(context, "id");
      const cashierId = uuidParam(context, "cashierId");
      const { status, reason } = parseBody(context.request, statusChangeValidator);

      return commandBus.execute<SetCashierStatusCommand, AdminCashierSummary>(
        new SetCashierStatusCommand({ actor, shopId, cashierId, status, reason }),
      );
    },

    resetCashierCredentials: async (context) => {
      const actor = requireAdmin(context, ADMIN_PERMISSION.CASHIERS_WRITE);

      return commandBus.execute<ResetCashierCredentialsCommand, CashierCredentials>(
        new ResetCashierCredentialsCommand(
          actor,
          uuidParam(context, "id"),
          uuidParam(context, "cashierId"),
        ),
      );
    },

    listAuditLogs: async (context) => {
      requireAdmin(context, ADMIN_PERMISSION.AUDIT_READ);

      const query = parseQuery(context.query, auditLogQueryValidator);

      return queryBus.execute<ListAuditLogsQuery, Page<AuditLogEntry>>(
        new ListAuditLogsQuery({
          ...(query.actor === undefined ? {} : { actor: query.actor }),
          ...(query.action === undefined ? {} : { action: query.action }),
          ...(query.resource === undefined ? {} : { resource: query.resource }),
          ...(query.severity === undefined ? {} : { severity: query.severity }),
          ...(query.from === undefined ? {} : { from: new Date(query.from) }),
          ...(query.to === undefined ? {} : { to: new Date(query.to) }),
          page: query.page ?? 1,
          pageSize: query.pageSize ?? LIST_LIMIT.AUDIT_PAGE_SIZE_DEFAULT,
        }),
      );
    },

    getSettings: async (context) => {
      requireAdmin(context, ADMIN_PERMISSION.SETTINGS_READ);

      return queryBus.execute<GetSettingsQuery, PlatformSettings>(new GetSettingsQuery());
    },

    updateSettings: async (context) => {
      const actor = requireAdmin(context, ADMIN_PERMISSION.SETTINGS_WRITE);
      const { reason, ...changes } = parseBody(context.request, updateSettingsValidator);

      return commandBus.execute<UpdateSettingsCommand, PlatformSettings>(
        new UpdateSettingsCommand(
          actor,
          Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined)),
          reason,
        ),
      );
    },
  };
}
