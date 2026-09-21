import { isConflictError } from "@zudojs/database";
import type { AdminRole, ShopRole } from "@betng/contracts";
import type { Logger } from "@betng/service-kit";
import type { IdentityConfig } from "../configs/index.js";
import type { IdentityStore, PasswordHasher } from "../interfaces/index.js";

const ADMIN_PASSWORD = "betng-admin";
const DEMO_PASSWORD = "betng-demo";

/** Known on purpose: enrol it in an authenticator, or run `pnpm totp:dev`. `SEED_ADMIN_TOTP_SECRET` overrides it. */
export const SEED_ADMIN_TOTP_SECRET = "BETNGDEVSEEDTOTPSECRET234567AAAA";

const ADMINS: readonly { email: string; name: string; role: AdminRole; twoFactor: boolean }[] = [
  { email: "ops@betng.test", name: "Ngozi Eze", role: "SUPER_ADMIN", twoFactor: true },
  { email: "operations@betng.test", name: "Tunde Bakare", role: "OPERATIONS", twoFactor: false },
  { email: "risk@betng.test", name: "Amara Obi", role: "RISK_ANALYST", twoFactor: false },
  { email: "support@betng.test", name: "Ibrahim Sani", role: "SUPPORT", twoFactor: false },
];

interface SeedCashier {
  readonly username: string;
  readonly displayName: string;
  readonly role: ShopRole;
  readonly pin: string;
  readonly suspended?: true;
}

const SHOPS: readonly {
  code: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  ownerName: string;
  cashiers: readonly SeedCashier[];
}[] = [
  {
    code: "BNG-LAG-001",
    name: "BetNG Allen Avenue",
    address: "42 Allen Avenue, Ikeja, Lagos",
    phone: "+234 803 555 0142",
    email: "allen.avenue@shops.betng.test",
    ownerName: "Adaeze Okonkwo",
    cashiers: [
      { username: "ada", displayName: "Adaeze Okonkwo", role: "OWNER", pin: "1234" },
      { username: "tunde", displayName: "Tunde Bakare", role: "MANAGER", pin: "1234" },
      { username: "bisi", displayName: "Bisi Adeyemi", role: "CASHIER", pin: "1234" },
      { username: "kunle", displayName: "Kunle Ojo", role: "CASHIER", pin: "1234", suspended: true },
    ],
  },
  {
    code: "BNG-ABJ-001",
    name: "BetNG Wuse Market",
    address: "Block C, Wuse Zone 5, Abuja",
    phone: "+234 809 555 0177",
    email: "wuse.market@shops.betng.test",
    ownerName: "Amina Yusuf",
    cashiers: [{ username: "amina", displayName: "Amina Yusuf", role: "OWNER", pin: "4321" }],
  },
];

const CUSTOMERS: readonly { email: string; displayName: string; phone: string }[] = [
  { email: "demo@betng.test", displayName: "Chidi Okafor", phone: "+234 803 555 0142" },
  { email: "amaka@betng.test", displayName: "Amaka Nwosu", phone: "+234 816 555 0193" },
  { email: "segun@betng.test", displayName: "Segun Afolabi", phone: "+234 705 555 0121" },
];

export interface DemoSeedOptions {
  readonly config: IdentityConfig;
  readonly store: IdentityStore;
  readonly hasher: PasswordHasher;
  readonly logger: Logger;
}

export async function runDemoSeed(options: DemoSeedOptions): Promise<boolean> {
  const { config, store, hasher, logger } = options;

  if (!config.security.seedDemoData || (await store.admins.count()) > 0) {
    return false;
  }

  logger.warn("demo.seed is creating development accounts with documented credentials", {
    event: "demo_seed_running",
    seed: "demo.seed",
    environment: config.service.environment,
  });

  const totpSecret = config.security.seedAdminTotpSecret ?? SEED_ADMIN_TOTP_SECRET;
  const adminHash = await hasher.hash(ADMIN_PASSWORD);
  const demoHash = await hasher.hash(DEMO_PASSWORD);
  const pinHashes = new Map<string, string>();

  for (const pin of new Set(SHOPS.flatMap((shop) => shop.cashiers.map((cashier) => cashier.pin)))) {
    pinHashes.set(pin, await hasher.hash(pin));
  }

  try {
    await store.transaction(async (repositories) => {
      for (const admin of ADMINS) {
        await repositories.admins.create({
          email: admin.email,
          name: admin.name,
          role: admin.role,
          passwordHash: adminHash,
          totpSecret: admin.twoFactor ? totpSecret : undefined,
        });
      }

      for (const { cashiers, ...details } of SHOPS) {
        const shop = await repositories.shops.create(details);

        for (const cashier of cashiers) {
          const created = await repositories.cashiers.create({
            shopId: shop.id,
            username: cashier.username,
            displayName: cashier.displayName,
            role: cashier.role,
            passwordHash: demoHash,
            pinHash: pinHashes.get(cashier.pin) ?? "",
            credentialsExpireAt: undefined,
          });

          if (cashier.suspended === true) {
            await repositories.cashiers.setStatus(created.id, "SUSPENDED");
          }
        }
      }

      for (const customer of CUSTOMERS) {
        await repositories.customers.create({
          ...customer,
          passwordHash: demoHash,
          emailVerifiedAt: new Date(),
        });
      }
    });
  } catch (error) {
    // Another instance starting at the same moment seeded first.
    if (isConflictError(error)) {
      return false;
    }

    throw error;
  }

  logger.warn("demo.seed finished", {
    event: "demo_seed_finished",
    seed: "demo.seed",
    admins: ADMINS.length,
    shops: SHOPS.length,
    customers: CUSTOMERS.length,
  });

  return true;
}
