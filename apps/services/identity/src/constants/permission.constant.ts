// The one place a role's reach is decided. Customers have no permissions.

import { adminPermissionSchema } from "@betng/contracts";
import type { AdminPermission, AdminRole, ShopPermission, ShopRole } from "@betng/contracts";

const CASHIER_PERMISSIONS: readonly ShopPermission[] = [
  "tickets:sell",
  "tickets:check",
  "tickets:payout",
];

const MANAGER_PERMISSIONS: readonly ShopPermission[] = [
  ...CASHIER_PERMISSIONS,
  "tickets:cancel",
  "transactions:read",
  "reports:read",
];

export const SHOP_ROLE_PERMISSIONS: Readonly<Record<ShopRole, readonly ShopPermission[]>> =
  Object.freeze({
    CASHIER: CASHIER_PERMISSIONS,
    MANAGER: MANAGER_PERMISSIONS,
    OWNER: [...MANAGER_PERMISSIONS, "cashiers:read"],
  });

export const ADMIN_ROLE_PERMISSIONS: Readonly<Record<AdminRole, readonly AdminPermission[]>> =
  Object.freeze({
    SUPER_ADMIN: adminPermissionSchema.options,
    OPERATIONS: [
      "shops:read",
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
    ],
    SUPPORT: ["users:read", "shops:read", "audit:read", "health:read"],
  });

export const ADMIN_PERMISSION = Object.freeze({
  USERS_READ: "users:read",
  USERS_WRITE: "users:write",
  SHOPS_READ: "shops:read",
  SHOPS_WRITE: "shops:write",
  CASHIERS_WRITE: "cashiers:write",
  AUDIT_READ: "audit:read",
  SETTINGS_READ: "settings:read",
  SETTINGS_WRITE: "settings:write",
} satisfies Record<string, AdminPermission>);

export const SHOP_PERMISSION = Object.freeze({
  CASHIERS_READ: "cashiers:read",
} satisfies Record<string, ShopPermission>);
