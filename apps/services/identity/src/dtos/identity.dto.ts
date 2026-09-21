/**
 * Row → contract mappers. These decide what leaves the service: no mapper
 * reads a hash, a TOTP secret or a token, so none can be returned by accident.
 */

import { asId } from "@betng/contracts";
import type {
  AdminCashierSummary,
  AdminCustomer,
  AdminShopSummary,
  AdminUser,
  AuditLogEntry,
  Cashier,
  CustomerProfile,
  Shop,
} from "@betng/contracts";
import {
  ADMIN_ROLE_PERMISSIONS,
  SHOP_ROLE_PERMISSIONS,
  SYSTEM_ACTOR,
} from "../constants/index.js";
import type {
  AdminUser as AdminUserRow,
  AuditLog as AuditLogRow,
  Cashier as CashierRow,
  Customer as CustomerRow,
  Shop as ShopRow,
} from "../generated/prisma/client.js";
import type {
  CashierFigures,
  CustomerFigures,
  ShopActivity,
  ShopFigures,
} from "../interfaces/index.js";

export interface ListDto<T> {
  readonly items: readonly T[];
}

/** The answer of `identity.authenticate`: who a token belongs to and what they may do. */
export interface AuthenticatedActorDto {
  readonly kind: "CUSTOMER" | "CASHIER" | "ADMIN";
  readonly id: string;
  readonly role: string;
  readonly name: string;
  readonly shopId?: string;
  readonly permissions: readonly string[];
  readonly expiresAt: string;
}

export interface PinVerificationDto {
  readonly valid: boolean;
}

export interface AuditRecordedDto {
  readonly id: string;
}

export function toCustomerProfile(row: CustomerRow): CustomerProfile {
  return {
    id: asId<"UserId">(row.id),
    email: row.email,
    displayName: row.displayName,
    ...(row.phone === null ? {} : { phone: row.phone }),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    lastActiveAt: row.lastActiveAt.toISOString(),
  };
}

export function toAdminCustomer(row: CustomerRow, figures: CustomerFigures | undefined): AdminCustomer {
  return {
    ...toCustomerProfile(row),
    balance: figures?.balance ?? 0,
    openBets: figures?.openBets ?? 0,
    lifetimeStake: figures?.lifetimeStake ?? 0,
    lifetimePayout: figures?.lifetimePayout ?? 0,
  };
}

export function toShop(row: ShopRow, balance: number): Shop {
  return {
    id: asId<"ShopId">(row.id),
    code: row.code,
    name: row.name,
    address: row.address,
    phone: row.phone,
    email: row.email,
    status: row.status,
    ownerName: row.ownerName,
    balance,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toAdminShopSummary(
  row: ShopRow,
  figures: ShopFigures | undefined,
  activity: ShopActivity | undefined,
): AdminShopSummary {
  return {
    ...toShop(row, figures?.balance ?? 0),
    cashierCount: activity?.cashierCount ?? 0,
    todaySales: figures?.todaySales ?? 0,
    todayPayouts: figures?.todayPayouts ?? 0,
    openTickets: figures?.openTickets ?? 0,
    ...(activity?.lastActiveAt === undefined
      ? {}
      : { lastActiveAt: activity.lastActiveAt.toISOString() }),
  };
}

export function toCashier(row: CashierRow): Cashier {
  return {
    id: asId<"CashierId">(row.id),
    shopId: asId<"ShopId">(row.shopId),
    username: row.username,
    displayName: row.displayName,
    role: row.role,
    status: row.status,
    ...(row.lastActiveAt === null ? {} : { lastActiveAt: row.lastActiveAt.toISOString() }),
    createdAt: row.createdAt.toISOString(),
  };
}

export function toAdminCashierSummary(
  row: CashierRow,
  figures: CashierFigures | undefined,
): AdminCashierSummary {
  return {
    ...toCashier(row),
    todayTransactions: figures?.todayTransactions ?? 0,
    todaySales: figures?.todaySales ?? 0,
  };
}

export function toAdminUser(row: AdminUserRow): AdminUser {
  return {
    id: asId<"AdminId">(row.id),
    email: row.email,
    displayName: row.name,
    role: row.role,
    twoFactorEnabled: row.twoFactorEnabled,
    permissions: ADMIN_ROLE_PERMISSIONS[row.role],
    ...(row.lastLoginAt === null ? {} : { lastLoginAt: row.lastLoginAt.toISOString() }),
  };
}

const ADMIN_ROLES: readonly string[] = Object.keys(ADMIN_ROLE_PERMISSIONS);
const SHOP_ROLES: readonly string[] = Object.keys(SHOP_ROLE_PERMISSIONS);

/** `admin:<id>`, `shop:<cashierId>` or `system`, as the audit screen expects. */
function auditActor(row: AuditLogRow): string {
  if (row.actorId === SYSTEM_ACTOR.id) {
    return SYSTEM_ACTOR.id;
  }

  if (ADMIN_ROLES.includes(row.actorRole)) {
    return `admin:${row.actorId}`;
  }

  if (SHOP_ROLES.includes(row.actorRole)) {
    return `shop:${row.actorId}`;
  }

  return `${row.actorRole.toLowerCase()}:${row.actorId}`;
}

export function toAuditLogEntry(row: AuditLogRow): AuditLogEntry {
  const mergeable =
    row.after === null || (typeof row.after === "object" && !Array.isArray(row.after));

  // The audit screen has no separate column for the reason; it reads it from `after`.
  const after =
    row.reason !== null && mergeable ? { ...(row.after ?? {}), reason: row.reason } : row.after;

  return {
    id: row.id,
    timestamp: row.createdAt.toISOString(),
    actor: auditActor(row),
    actorName: row.actorName,
    role: row.actorRole,
    action: row.action,
    resource: row.entityType,
    resourceId: row.entityId,
    severity: row.severity,
    ...(row.before === null ? {} : { before: row.before }),
    ...(after === null ? {} : { after }),
    requestId: row.requestId,
  };
}
