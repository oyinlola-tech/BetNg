import { adminPermissionSchema, shopPermissionSchema } from "@betng/contracts";
import { describe, expect, it } from "vitest";
import { ADMIN_ROLE_PERMISSIONS, SHOP_ROLE_PERMISSIONS } from "../src/constants/index.js";
import { redactSnapshot } from "../src/utils/index.js";

describe("role → permission maps", () => {
  it("gives SUPER_ADMIN every admin permission", () => {
    expect([...ADMIN_ROLE_PERMISSIONS.SUPER_ADMIN].sort()).toEqual([...adminPermissionSchema.options].sort());
  });

  it("matches the maps the admin app was built against", () => {
    expect(ADMIN_ROLE_PERMISSIONS.OPERATIONS).toEqual([
      "shops:read", "catalogue:read", "fixtures:read", "fixtures:operate", "odds:read", "risk:read",
      "simulation:read", "simulation:operate", "settlement:read", "settlement:operate", "reports:read",
      "audit:read", "health:read", "settings:read", "payments:read",
    ]);
    expect(ADMIN_ROLE_PERMISSIONS.RISK_ANALYST).toEqual([
      "catalogue:read", "fixtures:read", "odds:read", "odds:write", "risk:read", "settlement:read",
      "reports:read", "health:read", "kyc:read", "payments:read",
    ]);
    expect(ADMIN_ROLE_PERMISSIONS.SUPPORT).toEqual(["users:read", "shops:read", "audit:read", "health:read", "kyc:read", "payments:read"]);
  });

  it("reserves KYC decisions for SUPER_ADMIN", () => {
    for (const role of ["OPERATIONS", "RISK_ANALYST", "SUPPORT"] as const) {
      expect(ADMIN_ROLE_PERMISSIONS[role]).not.toContain("kyc:write");
    }

    expect(ADMIN_ROLE_PERMISSIONS.SUPER_ADMIN).toContain("kyc:write");
  });

  it("keeps write permissions away from SUPPORT and only valid values everywhere", () => {
    expect(ADMIN_ROLE_PERMISSIONS.SUPPORT.some((permission) => /:(write|operate)$/u.test(permission))).toBe(false);

    for (const permissions of Object.values(ADMIN_ROLE_PERMISSIONS)) {
      for (const permission of permissions) {
        expect(adminPermissionSchema.options).toContain(permission);
      }
    }
  });

  it("resolves shop roles", () => {
    expect(SHOP_ROLE_PERMISSIONS.CASHIER).toEqual(["tickets:sell", "tickets:check", "tickets:payout", "shifts:operate"]);
    expect(SHOP_ROLE_PERMISSIONS.MANAGER).toEqual([
      "tickets:sell", "tickets:check", "tickets:payout", "shifts:operate", "tickets:cancel", "transactions:read", "reports:read", "cash:move",
    ]);
    expect([...SHOP_ROLE_PERMISSIONS.OWNER].sort()).toEqual([...shopPermissionSchema.options].sort());
  });
});

describe("redactSnapshot", () => {
  it("drops secret-looking keys at every depth", () => {
    const redacted = redactSnapshot({
      username: "ada",
      passwordHash: "x",
      temporaryPin: "1234",
      nested: { sessionToken: "t", totpSecret: "s", keep: 1, list: [{ PIN: "9", label: "ok" }] },
    });

    expect(redacted).toEqual({ username: "ada", nested: { keep: 1, list: [{ label: "ok" }] } });
  });

  it("bounds the stored size and passes absent values through", () => {
    expect(redactSnapshot({ blob: "x".repeat(40_000) })).toMatchObject({ truncated: true });
    expect(redactSnapshot(undefined)).toBeUndefined();
    expect(redactSnapshot(null)).toBeUndefined();
  });
});
