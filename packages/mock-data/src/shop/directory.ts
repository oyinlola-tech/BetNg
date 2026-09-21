import type { Cashier, CashierId, Shop, ShopId, ShopPermission, ShopRole } from "@betng/contracts";
import { uuidFrom } from "../prng.js";

export const DEMO_PASSWORD = "betng-demo";
export const DEMO_PIN = "1234";
export const OPENING_FLOAT = 50_000_000;
export const TICKET_EXPIRY_DAYS = 7;

export const SHOP_ID = uuidFrom("shop:BNG-LAG-001") as ShopId;

export const SHOP: Omit<Shop, "balance"> = {
  id: SHOP_ID,
  code: "BNG-LAG-001",
  name: "BetNG Allen Avenue",
  address: "42 Allen Avenue, Ikeja, Lagos",
  phone: "+234 803 555 0142",
  email: "allen.avenue@shops.betng.example",
  status: "ACTIVE",
  ownerName: "Adaeze Okonkwo",
  createdAt: "2026-03-02T08:00:00.000Z",
};

const cashier = (username: string, displayName: string, role: ShopRole, status: Cashier["status"] = "ACTIVE"): Cashier => ({
  id: uuidFrom(`cashier:${username}`) as CashierId,
  shopId: SHOP_ID,
  username,
  displayName,
  role,
  status,
  createdAt: "2026-03-02T08:00:00.000Z",
});

export const CASHIERS: readonly Cashier[] = [
  cashier("ada", "Adaeze Okonkwo", "OWNER"),
  cashier("tunde", "Tunde Bakare", "MANAGER"),
  cashier("bisi", "Bisi Adeyemi", "CASHIER"),
  cashier("kunle", "Kunle Ojo", "CASHIER", "SUSPENDED"),
];

export const COUNTER_STAFF: readonly Cashier[] = CASHIERS.filter((c) => c.status === "ACTIVE" && c.role !== "OWNER");

const CASHIER_PERMISSIONS: readonly ShopPermission[] = ["tickets:sell", "tickets:check", "tickets:payout"];
const MANAGER_PERMISSIONS: readonly ShopPermission[] = [...CASHIER_PERMISSIONS, "tickets:cancel", "transactions:read", "reports:read"];

export const ROLE_PERMISSIONS: Readonly<Record<ShopRole, readonly ShopPermission[]>> = {
  CASHIER: CASHIER_PERMISSIONS,
  MANAGER: MANAGER_PERMISSIONS,
  OWNER: [...MANAGER_PERMISSIONS, "cashiers:read"],
};

export const CUSTOMERS: readonly (readonly [string, string])[] = [
  ["Chinedu Eze", "0803 412 7781"],
  ["Funmilayo Alabi", "0816 209 4450"],
  ["Ibrahim Musa", "0705 883 1209"],
  ["Ngozi Umeh", "0902 774 6018"],
  ["Segun Afolabi", "0813 660 2395"],
  ["Yetunde Salako", "0708 145 9932"],
  ["Emeka Nwosu", "0809 321 5567"],
  ["Halima Bello", "0906 418 2270"],
  ["Tobi Ogunleye", "0817 903 6641"],
  ["Blessing Etim", "0703 556 1184"],
];
