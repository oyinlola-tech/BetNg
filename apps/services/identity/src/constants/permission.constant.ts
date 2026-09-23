// The one place a role's reach is decided. Customers have no permissions.

import { adminPermissionSchema } from "@betng/contracts";
import type { AdminPermission, AdminRole, ShopPermission, ShopRole } from "@betng/contracts";

const CASHIER_PERMISSIONS: readonly ShopPermission[] = [
  "tickets:sell",
  "tickets:check",
  "tickets:payout",
  "shifts:operate",
];

const MANAGER_PERMISSIONS: readonly ShopPermission[] = [
  ...CASHIER_PERMISSIONS,
  "tickets:cancel",
  "transactions:read",
  "reports:read",
  "cash:move",
];

export const SHOP_ROLE_PERMISSIONS: Readonly<Record<ShopRole, readonly ShopPermission[]>> =
  Object.freeze({
    CASHIER: CASHIER_PERMISSIONS,
    // A manager moves float between drawers but does not decide who works in the shop.
    MANAGER: [...MANAGER_PERMISSIONS, "cashiers:read", "cash:transfer"],
    // An owner staffs and funds their own shop.
    OWNER: [...MANAGER_PERMISSIONS, "cashiers:read", "cash:transfer", "cashiers:write"],
  });

export const ADMIN_ROLE_PERMISSIONS: Readonly<Record<AdminRole, readonly AdminPermission[]>> =
  Object.freeze({
    SUPER_ADMIN: adminPermissionSchema.options,
    OPERATIONS: [
      "shops:read",
      // Operations vets applications; approving one creates a shop and its owner.
      "shop-applications:read",
      "shop-applications:write",
      "catalogue:read",
      "fixtures:read",
      "fixtures:operate",
      "odds:read",
      "risk:read",
      "simulation:read",
      "simulation:operate",
      "settlement:read",
      "settlement:operate",
      "reports:read",
      "audit:read",
      "health:read",
      "settings:read",
      "payments:read",
    ],
    RISK_ANALYST: [
      "catalogue:read",
      "fixtures:read",
      "odds:read",
      "odds:write",
      "risk:read",
      "settlement:read",
      "reports:read",
      "health:read",
      "kyc:read",
      "payments:read",
    ],
    SUPPORT: ["users:read", "shops:read", "shop-applications:read", "audit:read", "health:read", "kyc:read", "payments:read"],
  });

export const ADMIN_PERMISSION = Object.freeze({
  ADMINS_READ: "admins:read",
  ADMINS_WRITE: "admins:write",
  USERS_READ: "users:read",
  USERS_WRITE: "users:write",
  SHOPS_READ: "shops:read",
  SHOPS_WRITE: "shops:write",
  SHOP_APPLICATIONS_READ: "shop-applications:read",
  SHOP_APPLICATIONS_WRITE: "shop-applications:write",
  CASHIERS_WRITE: "cashiers:write",
  AUDIT_READ: "audit:read",
  SETTINGS_READ: "settings:read",
  SETTINGS_WRITE: "settings:write",
  KYC_READ: "kyc:read",
  KYC_WRITE: "kyc:write",
} satisfies Record<string, AdminPermission>);

export const SHOP_PERMISSION = Object.freeze({
  CASHIERS_READ: "cashiers:read",
  CASHIERS_WRITE: "cashiers:write",
  CASH_MOVE: "cash:move",
  CASH_TRANSFER: "cash:transfer",
} satisfies Record<string, ShopPermission>);
