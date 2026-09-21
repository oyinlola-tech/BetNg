import type {
  AdminCashierSummary,
  AdminCustomer,
  AdminId,
  AdminRole,
  AdminShopSummary,
  AdminUser,
  CashierId,
  PlatformSettings,
  ShopId,
  ShopRole,
  TeamRatings,
  UserId,
} from "@betng/contracts";
import { rng, uuidFrom } from "../prng.js";

export const ADMIN_PASSWORD = "betng-admin";
export const ADMIN_TOTP = "246810";

const ALL_PERMISSIONS = [
  "users:read",
  "users:write",
  "shops:read",
  "shops:write",
  "cashiers:write",
  "catalogue:read",
  "catalogue:write",
  "fixtures:read",
  "fixtures:operate",
  "odds:read",
  "odds:write",
  "risk:read",
  "risk:write",
  "simulation:read",
  "simulation:operate",
  "settlement:read",
  "settlement:operate",
  "wallet:read",
  "reports:read",
  "audit:read",
  "health:read",
  "settings:read",
  "settings:write",
  "kyc:read",
  "kyc:write",
  "payments:read",
  "payments:write",
] as const;

export const ROLE_PERMISSIONS: Readonly<Record<AdminRole, readonly string[]>> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
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
  RISK_ANALYST: ["catalogue:read", "fixtures:read", "odds:read", "odds:write", "risk:read", "settlement:read", "reports:read", "health:read"],
  SUPPORT: ["users:read", "shops:read", "audit:read", "health:read"],
};

function admin(email: string, displayName: string, role: AdminRole, twoFactorEnabled: boolean): AdminUser {
  return { id: uuidFrom(`admin:${email}`) as AdminId, email, displayName, role, twoFactorEnabled, permissions: ROLE_PERMISSIONS[role] };
}

export const ADMINS: readonly AdminUser[] = [
  admin("ops@betng.test", "Ngozi Eze", "SUPER_ADMIN", true),
  admin("operations@betng.test", "Tunde Bakare", "OPERATIONS", false),
  admin("risk@betng.test", "Amara Obi", "RISK_ANALYST", false),
  admin("support@betng.test", "Ibrahim Sani", "SUPPORT", false),
];

const FIRST = ["Chinedu", "Aisha", "Emeka", "Funke", "Yusuf", "Blessing", "Segun", "Halima", "Ifeanyi", "Kemi", "Musa", "Ngozi", "Tobi", "Zainab", "Uche", "Bola", "Sani", "Ada", "Femi", "Hauwa"];
const LAST = ["Okafor", "Bello", "Adeyemi", "Nwosu", "Abubakar", "Eze", "Ogunleye", "Danjuma", "Okonkwo", "Lawal", "Ibe", "Yakubu", "Onyeka", "Balogun", "Umeh", "Aliyu"];

const SHOP_SITES: readonly (readonly [string, string, string])[] = [
  ["LAG", "Ikeja Central", "14 Allen Avenue, Ikeja, Lagos"],
  ["LAG", "Surulere Arena", "62 Adeniran Ogunsanya St, Surulere, Lagos"],
  ["LAG", "Lekki Phase One", "Plot 9 Admiralty Way, Lekki, Lagos"],
  ["LAG", "Yaba Tech Hub", "31 Herbert Macaulay Way, Yaba, Lagos"],
  ["ABJ", "Wuse Market", "Block C, Wuse Zone 5, Abuja"],
  ["ABJ", "Garki Junction", "7 Ahmadu Bello Way, Garki, Abuja"],
  ["PHC", "Rumuola Road", "118 Rumuola Rd, Port Harcourt"],
  ["PHC", "Garrison Point", "5 Aba Road, Port Harcourt"],
  ["KAN", "Sabon Gari", "22 Ibrahim Taiwo Rd, Kano"],
  ["IBD", "Bodija Market", "9 Secretariat Rd, Bodija, Ibadan"],
  ["ENU", "Ogui Road", "44 Ogui Rd, Enugu"],
  ["BEN", "Ring Road", "3 Ring Rd, Benin City"],
  ["KAD", "Ahmadu Bello Way", "70 Ahmadu Bello Way, Kaduna"],
  ["ABK", "Panseke", "16 Panseke Rd, Abeokuta"],
];

const person = (seed: string): string => {
  const r = rng(`person:${seed}`);

  return `${r.pick(FIRST)} ${r.pick(LAST)}`;
};

export function seedShops(now: number): readonly AdminShopSummary[] {
  const counters = new Map<string, number>();

  return SHOP_SITES.map(([city, name, address], index): AdminShopSummary => {
    const n = (counters.get(city) ?? 0) + 1;

    counters.set(city, n);

    const code = `BNG-${city}-${String(n).padStart(3, "0")}`;
    const r = rng(`shop:${code}`);
    const status = index === 5 ? "SUSPENDED" : index === 9 || index === 12 ? "OFFLINE" : "ACTIVE";
    const sales = status === "ACTIVE" ? r.int(180, 960) * 100_000 : status === "OFFLINE" ? r.int(20, 90) * 100_000 : 0;

    return {
      id: uuidFrom(`shop:${code}`) as ShopId,
      code,
      name: `BetNG ${name}`,
      address,
      phone: `+234 80${String(r.int(1, 9))} ${String(r.int(100, 999))} ${String(r.int(1000, 9999))}`,
      email: `${code.toLowerCase()}@shops.betng.test`,
      status,
      ownerName: person(`owner:${code}`),
      balance: r.int(400, 2400) * 100_000,
      createdAt: new Date(Date.UTC(2025, r.int(0, 11), r.int(1, 28))).toISOString(),
      cashierCount: 0,
      todaySales: sales,
      todayPayouts: Math.round(sales * (0.55 + r.next() * 0.4)),
      openTickets: status === "ACTIVE" ? r.int(8, 64) : 0,
      lastActiveAt: new Date(now - (status === "ACTIVE" ? r.int(5, 900) * 1000 : r.int(3, 70) * 3_600_000)).toISOString(),
    };
  });
}

export function seedCashiers(shop: AdminShopSummary, now: number): readonly AdminCashierSummary[] {
  const r = rng(`cashiers:${shop.code}`);
  const roles: ShopRole[] = ["OWNER", "MANAGER", ...Array.from({ length: r.int(1, 4) }, (): ShopRole => "CASHIER")];

  return roles.map((role, index): AdminCashierSummary => {
    const displayName = role === "OWNER" ? shop.ownerName : person(`cashier:${shop.code}:${String(index)}`);
    const active = shop.status === "ACTIVE" && !(role === "CASHIER" && r.chance(0.15));
    const transactions = active && role !== "OWNER" ? r.int(12, 140) : 0;

    return {
      id: uuidFrom(`cashier:${shop.code}:${String(index)}`) as CashierId,
      shopId: shop.id,
      username: `${(displayName.split(" ")[0] ?? "user").toLowerCase()}.${String(index + 1)}`,
      displayName,
      role,
      status: shop.status === "SUSPENDED" || (!active && role === "CASHIER" && r.chance(0.5)) ? "SUSPENDED" : "ACTIVE",
      lastActiveAt: new Date(now - (active ? r.int(10, 3000) * 1000 : r.int(20, 200) * 3_600_000)).toISOString(),
      createdAt: shop.createdAt,
      todayTransactions: transactions,
      todaySales: transactions * r.int(8, 40) * 10_000,
    };
  });
}

export function seedCustomers(now: number): readonly AdminCustomer[] {
  return Array.from({ length: 42 }, (_, index): AdminCustomer => {
    const r = rng(`customer:${String(index)}`);
    const displayName = person(`customer:${String(index)}`);
    const stake = r.int(5, 900) * 100_000;
    const handle = displayName.toLowerCase().replace(/\s+/g, ".");

    return {
      id: uuidFrom(`customer:${String(index)}`) as UserId,
      email: `${handle}${String(index)}@mail.test`,
      displayName,
      phone: `+234 81${String(r.int(1, 9))} ${String(r.int(100, 999))} ${String(r.int(1000, 9999))}`,
      status: index % 13 === 7 ? "SUSPENDED" : "ACTIVE",
      createdAt: new Date(now - r.int(3, 420) * 86_400_000).toISOString(),
      lastActiveAt: new Date(now - r.int(1, 4000) * 60_000).toISOString(),
      balance: r.int(0, 480) * 50_000,
      openBets: r.int(0, 6),
      lifetimeStake: stake,
      lifetimePayout: Math.round(stake * (0.6 + r.next() * 0.5)),
    };
  });
}

const clamp = (value: number): number => Math.max(1, Math.min(99, Math.round(value)));

export function ratingsFor(teamKey: string, strength: number): TeamRatings {
  const r = rng(`ratings:${teamKey}`);
  const around = (spread: number): number => clamp(strength + (r.next() - 0.5) * spread);

  return { attack: around(12), midfield: around(8), defence: around(12), goalkeeper: around(10), pace: around(16), finishing: around(14), form: r.int(-6, 8) };
}

export const DEFAULT_SETTINGS: PlatformSettings = {
  minStake: 5_000,
  maxStake: 50_000_000,
  maxPayout: 2_000_000_000,
  maxSelections: 20,
  bettingCloseSeconds: 10,
  ticketExpiryDays: 30,
  exposureLimit: 1_500_000_000,
  maintenanceMode: false,
};

export const SERVICES = ["gateway", "match", "betting", "wallet", "settlement", "odds", "risk", "simulation", "event", "scheduler", "analytics"] as const;
