import { z } from "@zudojs/validation";
import {
  brandedIdSchema,
  decimalOddsSchema,
  isoTimestampSchema,
  minorUnitsSchema,
  type Branded,
  type MarketId,
  type MatchId,
  type SelectionId,
} from "../common/index.js";

export type ShopId = Branded<"ShopId">;
export type CashierId = Branded<"CashierId">;
export type TicketId = Branded<"TicketId">;

export const shopStatusSchema = z.enum(["ACTIVE", "SUSPENDED", "OFFLINE"]);

export type ShopStatus = z.infer<typeof shopStatusSchema>;

export interface Shop {
  readonly id: ShopId;
  /** Operator-facing code, e.g. `BNG-LAG-001`. */
  readonly code: string;
  readonly name: string;
  readonly address: string;
  readonly phone: string;
  readonly email: string;
  readonly status: ShopStatus;
  readonly ownerName: string;
  readonly balance: number;
  readonly createdAt: string;
}

export const shopSchema = z.object({
  id: brandedIdSchema<"ShopId">(),
  code: z.string().min(3).max(20),
  name: z.string().min(2).max(80),
  address: z.string().max(160),
  phone: z.string().max(20),
  email: z.email(),
  status: shopStatusSchema,
  ownerName: z.string().max(80),
  balance: minorUnitsSchema.min(0),
  createdAt: isoTimestampSchema,
});

export const createShopRequestSchema = shopSchema.pick({ code: true, name: true, address: true, phone: true, email: true, ownerName: true });

export type CreateShopRequest = z.infer<typeof createShopRequestSchema>;

export const shopRoleSchema = z.enum(["OWNER", "MANAGER", "CASHIER"]);

export type ShopRole = z.infer<typeof shopRoleSchema>;

export interface Cashier {
  readonly id: CashierId;
  readonly shopId: ShopId;
  readonly username: string;
  readonly displayName: string;
  readonly role: ShopRole;
  readonly status: "ACTIVE" | "SUSPENDED";
  readonly lastActiveAt?: string | undefined;
  readonly createdAt: string;
}

export const cashierSchema = z.object({
  id: brandedIdSchema<"CashierId">(),
  shopId: brandedIdSchema<"ShopId">(),
  username: z.string().min(2).max(40),
  displayName: z.string().min(2).max(60),
  role: shopRoleSchema,
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  lastActiveAt: isoTimestampSchema.optional(),
  createdAt: isoTimestampSchema,
});

export const shopLoginRequestSchema = z.object({
  shopCode: z.string().min(3).max(20),
  username: z.string().min(2).max(40),
  password: z.string().min(1).max(128),
  pin: z.string().regex(/^\d{4,6}$/).optional(),
});

export type ShopLoginRequest = z.infer<typeof shopLoginRequestSchema>;

export interface ShopSession {
  readonly token: string;
  readonly expiresAt: string;
  readonly shop: Shop;
  readonly cashier: Cashier;
  readonly permissions?: readonly string[] | undefined;
}

export const shopSessionSchema = z.object({
  token: z.string().min(16),
  expiresAt: isoTimestampSchema,
  shop: shopSchema,
  cashier: cashierSchema,
  permissions: z.array(z.string().max(40)).optional(),
});

export const shopPermissionSchema = z.enum(["tickets:sell", "tickets:check", "tickets:payout", "tickets:cancel", "transactions:read", "reports:read", "cashiers:read"]);

export type ShopPermission = z.infer<typeof shopPermissionSchema>;

export const ticketStatusSchema = z.enum(["PENDING", "OPEN", "WON", "LOST", "VOID", "CANCELLED", "PAID", "EXPIRED"]);

export type TicketStatus = z.infer<typeof ticketStatusSchema>;

export interface TicketSelection {
  readonly matchId: MatchId;
  readonly marketId: MarketId;
  readonly selectionId: SelectionId;
  readonly odds: number;
  readonly marketType: string;
  readonly marketLabel: string;
  readonly selectionLabel: string;
  readonly matchLabel: string;
  readonly leagueName: string;
  readonly kickoffAt: string;
  readonly outcome: "PENDING" | "WON" | "LOST" | "VOID";
  readonly result?: string | undefined;
}

export const ticketSelectionSchema = z.object({
  matchId: brandedIdSchema<"MatchId">(),
  marketId: brandedIdSchema<"MarketId">(),
  selectionId: brandedIdSchema<"SelectionId">(),
  odds: decimalOddsSchema,
  marketType: z.string().max(32),
  marketLabel: z.string().max(64),
  selectionLabel: z.string().max(64),
  matchLabel: z.string().max(160),
  leagueName: z.string().max(120),
  kickoffAt: isoTimestampSchema,
  outcome: z.enum(["PENDING", "WON", "LOST", "VOID"]),
  result: z.string().max(16).optional(),
});

export interface Ticket {
  readonly id: TicketId;
  /** Human code printed on the slip, e.g. `BNG-82K91A`. */
  readonly code: string;
  readonly shopId: ShopId;
  readonly shopCode: string;
  readonly cashierId: CashierId;
  readonly cashierName: string;
  readonly customerName?: string | undefined;
  readonly customerPhone?: string | undefined;
  readonly selections: readonly TicketSelection[];
  readonly stake: number;
  readonly totalOdds: number;
  readonly potentialPayout: number;
  readonly status: TicketStatus;
  readonly payout?: number | undefined;
  readonly placedAt: string;
  readonly settledAt?: string | undefined;
  readonly paidAt?: string | undefined;
  readonly expiresAt: string;
}

export const ticketSchema = z.object({
  id: brandedIdSchema<"TicketId">(),
  code: z.string().min(6).max(16),
  shopId: brandedIdSchema<"ShopId">(),
  shopCode: z.string().max(20),
  cashierId: brandedIdSchema<"CashierId">(),
  cashierName: z.string().max(60),
  customerName: z.string().max(80).optional(),
  customerPhone: z.string().max(20).optional(),
  selections: z.array(ticketSelectionSchema).min(1).max(20),
  stake: minorUnitsSchema.min(1),
  totalOdds: decimalOddsSchema,
  potentialPayout: minorUnitsSchema.min(1),
  status: ticketStatusSchema,
  payout: minorUnitsSchema.min(0).optional(),
  placedAt: isoTimestampSchema,
  settledAt: isoTimestampSchema.optional(),
  paidAt: isoTimestampSchema.optional(),
  expiresAt: isoTimestampSchema,
});

export const placeTicketRequestSchema = z.object({
  selections: z
    .array(z.object({ matchId: brandedIdSchema<"MatchId">(), marketId: brandedIdSchema<"MarketId">(), selectionId: brandedIdSchema<"SelectionId">(), odds: decimalOddsSchema }))
    .min(1)
    .max(20),
  stake: minorUnitsSchema.min(1),
  customerName: z.string().max(80).optional(),
  customerPhone: z.string().max(20).optional(),
});

export type PlaceTicketRequest = z.infer<typeof placeTicketRequestSchema>;

/** Paying out moves cash, so the cashier re-enters their PIN. */
export const payoutTicketRequestSchema = z.object({ pin: z.string().regex(/^\d{4,6}$/) });

export type PayoutTicketRequest = z.infer<typeof payoutTicketRequestSchema>;

export const cancelTicketRequestSchema = z.object({ reason: z.string().min(4).max(160) });

export type CancelTicketRequest = z.infer<typeof cancelTicketRequestSchema>;

export const shopTransactionTypeSchema = z.enum(["TICKET_SALE", "TICKET_PAYOUT", "CASH_IN", "CASH_OUT", "TICKET_CANCEL"]);

export type ShopTransactionType = z.infer<typeof shopTransactionTypeSchema>;

export interface ShopTransaction {
  readonly id: string;
  readonly shopId: ShopId;
  readonly cashierId: CashierId;
  readonly cashierName: string;
  readonly type: ShopTransactionType;
  /** Signed, minor units: sales and cash-in credit the float, payouts and cash-out debit it. */
  readonly amount: number;
  readonly balanceAfter: number;
  readonly reference?: string | undefined;
  readonly note?: string | undefined;
  readonly createdAt: string;
}

export const shopTransactionSchema = z.object({
  id: z.uuid(),
  shopId: brandedIdSchema<"ShopId">(),
  cashierId: brandedIdSchema<"CashierId">(),
  cashierName: z.string().max(60),
  type: shopTransactionTypeSchema,
  amount: minorUnitsSchema,
  balanceAfter: minorUnitsSchema.min(0),
  reference: z.string().max(40).optional(),
  note: z.string().max(160).optional(),
  createdAt: isoTimestampSchema,
});

export interface ShopDailyReport {
  readonly shopId: ShopId;
  readonly date: string;
  readonly ticketsSold: number;
  readonly sales: number;
  readonly payouts: number;
  readonly cancellations: number;
  readonly openTickets: number;
  readonly net: number;
  readonly byCashier: readonly { readonly cashierId: CashierId; readonly cashierName: string; readonly ticketsSold: number; readonly sales: number; readonly payouts: number }[];
  readonly byLeague: readonly { readonly leagueName: string; readonly ticketsSold: number; readonly sales: number }[];
}

export const shopDailyReportSchema = z.object({
  shopId: brandedIdSchema<"ShopId">(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ticketsSold: z.int().min(0),
  sales: minorUnitsSchema.min(0),
  payouts: minorUnitsSchema.min(0),
  cancellations: z.int().min(0),
  openTickets: z.int().min(0),
  net: minorUnitsSchema,
  byCashier: z.array(z.object({ cashierId: brandedIdSchema<"CashierId">(), cashierName: z.string(), ticketsSold: z.int(), sales: minorUnitsSchema, payouts: minorUnitsSchema })),
  byLeague: z.array(z.object({ leagueName: z.string(), ticketsSold: z.int(), sales: minorUnitsSchema })),
});
