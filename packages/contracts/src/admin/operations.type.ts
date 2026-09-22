/** What the admin control plane reads and operates on. The platform is authoritative for every value here. */

import { z } from "@zudojs/validation";
import { brandedIdSchema, decimalOddsSchema, isoTimestampSchema, minorUnitsSchema } from "../common/index.js";
import { marketStatusSchema } from "../odds/index.js";
import { matchStatusSchema } from "../match/index.js";
import { cashierSchema, shopSchema } from "../shop/index.js";
import { customerProfileSchema } from "../auth/index.js";
import { simulationRunSchema } from "./admin.type.js";

export const adminPermissionSchema = z.enum([
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
]);

export type AdminPermission = z.infer<typeof adminPermissionSchema>;

export const adminCustomerSchema = customerProfileSchema.extend({
  balance: minorUnitsSchema.min(0),
  openBets: z.int().min(0),
  lifetimeStake: minorUnitsSchema.min(0),
  lifetimePayout: minorUnitsSchema.min(0),
});

export type AdminCustomer = z.infer<typeof adminCustomerSchema>;

/** An operator correction to a customer's details. Balances are never editable here. */
export const adminUpdateCustomerRequestSchema = z
  .object({
    displayName: z.string().trim().min(2).max(60).optional(),
    phone: z.string().regex(/^\+?[0-9 ]{7,20}$/).optional(),
    reason: z.string().trim().min(4).max(300),
  })
  .refine((body) => body.displayName !== undefined || body.phone !== undefined, "Change at least one field.");

export type AdminUpdateCustomerRequest = z.infer<typeof adminUpdateCustomerRequestSchema>;

export const adminPasswordResetRequestSchema = z.object({ reason: z.string().trim().min(4).max(300) });

export type AdminPasswordResetRequest = z.infer<typeof adminPasswordResetRequestSchema>;

export const adminShopSummarySchema = shopSchema.extend({
  cashierCount: z.int().min(0),
  todaySales: minorUnitsSchema.min(0),
  todayPayouts: minorUnitsSchema.min(0),
  openTickets: z.int().min(0),
  lastActiveAt: isoTimestampSchema.optional(),
});

export type AdminShopSummary = z.infer<typeof adminShopSummarySchema>;

export const adminCashierSummarySchema = cashierSchema.extend({
  todayTransactions: z.int().min(0),
  todaySales: minorUnitsSchema.min(0),
});

export type AdminCashierSummary = z.infer<typeof adminCashierSummarySchema>;

export const createCashierRequestSchema = cashierSchema.pick({ username: true, displayName: true, role: true });

export type CreateCashierRequest = z.infer<typeof createCashierRequestSchema>;

/** One-time credentials shown once after a create or reset; the platform stores only hashes. */
export const cashierCredentialsSchema = z.object({
  username: z.string(),
  temporaryPassword: z.string(),
  temporaryPin: z.string(),
  expiresAt: isoTimestampSchema,
});

export type CashierCredentials = z.infer<typeof cashierCredentialsSchema>;

const rating = z.int().min(1).max(99);

/** Simulation inputs for a team. The simulation service reads these; nothing here decides a result. */
export const teamRatingsSchema = z.object({
  attack: rating,
  midfield: rating,
  defence: rating,
  goalkeeper: rating,
  pace: rating,
  finishing: rating,
  form: z.int().min(-10).max(10),
});

export type TeamRatings = z.infer<typeof teamRatingsSchema>;

export const adminTeamSchema = z.object({
  id: brandedIdSchema<"TeamId">(),
  leagueId: brandedIdSchema<"LeagueId">(),
  leagueName: z.string(),
  name: z.string().min(1).max(120),
  shortName: z.string().min(2).max(12),
  code: z.string().min(2).max(4),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  colors: z.object({ primary: z.string(), secondary: z.string() }),
  ratings: teamRatingsSchema,
  updatedAt: isoTimestampSchema,
});

export type AdminTeam = z.infer<typeof adminTeamSchema>;

export const updateTeamRequestSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  shortName: z.string().min(2).max(12).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  ratings: teamRatingsSchema.partial().optional(),
});

export type UpdateTeamRequest = z.infer<typeof updateTeamRequestSchema>;

export const bettingStatusSchema = z.enum(["NOT_OPEN", "OPEN", "CLOSED", "SUSPENDED"]);
export const simulationStatusSchema = z.enum(["QUEUED", "READY", "RUNNING", "COMPLETED", "FAILED"]);
export const settlementStatusSchema = z.enum(["NOT_DUE", "PENDING", "COMPLETED", "FAILED", "VOIDED"]);

export type BettingStatus = z.infer<typeof bettingStatusSchema>;
export type SimulationStatus = z.infer<typeof simulationStatusSchema>;
export type SettlementStatus = z.infer<typeof settlementStatusSchema>;

export const adminFixtureSchema = z.object({
  matchId: brandedIdSchema<"MatchId">(),
  leagueId: brandedIdSchema<"LeagueId">(),
  leagueName: z.string(),
  season: z.int(),
  matchday: z.int(),
  homeName: z.string(),
  awayName: z.string(),
  kickoffAt: isoTimestampSchema,
  score: z.object({ home: z.int(), away: z.int() }),
  matchStatus: matchStatusSchema,
  bettingStatus: bettingStatusSchema,
  simulationStatus: simulationStatusSchema,
  settlementStatus: settlementStatusSchema,
});

export type AdminFixture = z.infer<typeof adminFixtureSchema>;

export const adminSelectionOddsSchema = z.object({
  selectionId: brandedIdSchema<"SelectionId">(),
  label: z.string(),
  currentOdds: decimalOddsSchema,
  openingOdds: decimalOddsSchema,
  modelProbability: z.number().min(0).max(1),
  stake: minorUnitsSchema.min(0),
  liability: minorUnitsSchema.min(0),
});

export const adminMarketOddsSchema = z.object({
  marketId: brandedIdSchema<"MarketId">(),
  matchId: brandedIdSchema<"MatchId">(),
  matchLabel: z.string(),
  leagueName: z.string(),
  marketType: z.string(),
  marketLabel: z.string(),
  status: marketStatusSchema,
  /** Overround: the sum of implied probabilities minus one. */
  margin: z.number(),
  exposure: minorUnitsSchema.min(0),
  selections: z.array(adminSelectionOddsSchema).min(1),
  updatedAt: isoTimestampSchema,
});

export type AdminSelectionOdds = z.infer<typeof adminSelectionOddsSchema>;
export type AdminMarketOdds = z.infer<typeof adminMarketOddsSchema>;

export const marketAdminActionRequestSchema = z.object({
  action: z.enum(["SUSPEND", "RESUME"]),
  reason: z.string().min(4).max(240),
});

export type MarketAdminActionRequest = z.infer<typeof marketAdminActionRequestSchema>;

export const riskStateSchema = z.enum(["NORMAL", "ELEVATED", "CRITICAL"]);

export type RiskState = z.infer<typeof riskStateSchema>;

export const riskOverviewSchema = z.object({
  totalStake: minorUnitsSchema.min(0),
  potentialPayout: minorUnitsSchema.min(0),
  exposure: minorUnitsSchema.min(0),
  exposureLimit: minorUnitsSchema.min(0),
  state: riskStateSchema,
  decisions: z.object({ accepted: z.int().min(0), limited: z.int().min(0), rejected: z.int().min(0) }),
  byMarket: z.array(z.object({ marketType: z.string(), marketLabel: z.string(), stake: minorUnitsSchema, exposure: minorUnitsSchema })),
  byMatch: z.array(
    z.object({
      matchId: brandedIdSchema<"MatchId">(),
      matchLabel: z.string(),
      leagueName: z.string(),
      kickoffAt: isoTimestampSchema,
      stake: minorUnitsSchema,
      exposure: minorUnitsSchema,
      state: riskStateSchema,
    }),
  ),
  generatedAt: isoTimestampSchema,
});

export type RiskOverview = z.infer<typeof riskOverviewSchema>;

export const adminSimulationRunSchema = simulationRunSchema.extend({
  status: simulationStatusSchema,
  matchLabel: z.string(),
  leagueName: z.string(),
  error: z.string().optional(),
});

export type AdminSimulationRun = z.infer<typeof adminSimulationRunSchema>;

export const simulationAdminActionSchema = z.enum(["RETRY", "CANCEL"]);

export type SimulationAdminAction = z.infer<typeof simulationAdminActionSchema>;

export const adminSettlementSchema = z.object({
  id: z.string(),
  betId: z.string(),
  ticketCode: z.string().optional(),
  /** `user:<displayName>` or `shop:<code>`. */
  owner: z.string(),
  channel: z.enum(["ONLINE", "SHOP"]),
  matchLabel: z.string(),
  result: z.string(),
  stake: minorUnitsSchema,
  payout: minorUnitsSchema.min(0),
  status: settlementStatusSchema,
  error: z.string().optional(),
  timestamp: isoTimestampSchema,
});

export type AdminSettlement = z.infer<typeof adminSettlementSchema>;

export const platformLedgerEntrySchema = z.object({
  id: z.string(),
  owner: z.string(),
  channel: z.enum(["ONLINE", "SHOP"]),
  type: z.enum(["DEPOSIT", "WITHDRAWAL", "STAKE", "PAYOUT", "REFUND"]),
  amount: minorUnitsSchema,
  reference: z.string().optional(),
  createdAt: isoTimestampSchema,
});

export const platformWalletOverviewSchema = z.object({
  customerBalances: minorUnitsSchema.min(0),
  shopFloats: minorUnitsSchema.min(0),
  reserved: minorUnitsSchema.min(0),
  todayDeposits: minorUnitsSchema.min(0),
  todayWithdrawals: minorUnitsSchema.min(0),
  entries: z.array(platformLedgerEntrySchema),
});

export type PlatformLedgerEntry = z.infer<typeof platformLedgerEntrySchema>;
export type PlatformWalletOverview = z.infer<typeof platformWalletOverviewSchema>;

export const platformReportDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  stake: minorUnitsSchema.min(0),
  payouts: minorUnitsSchema.min(0),
  net: minorUnitsSchema,
  bets: z.int().min(0),
  onlineStake: minorUnitsSchema.min(0),
  shopStake: minorUnitsSchema.min(0),
});

export type PlatformReportDay = z.infer<typeof platformReportDaySchema>;

export const platformSettingsSchema = z.object({
  minStake: minorUnitsSchema.min(1),
  maxStake: minorUnitsSchema.min(1),
  maxPayout: minorUnitsSchema.min(1),
  maxSelections: z.int().min(1).max(40),
  bettingCloseSeconds: z.int().min(0),
  ticketExpiryDays: z.int().min(1),
  exposureLimit: minorUnitsSchema.min(0),
  maintenanceMode: z.boolean(),
});

export type PlatformSettings = z.infer<typeof platformSettingsSchema>;

export const auditSeveritySchema = z.enum(["INFO", "NOTICE", "WARNING", "CRITICAL"]);

export type AuditSeverity = z.infer<typeof auditSeveritySchema>;

export const auditLogQuerySchema = z.object({
  actor: z.string().optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  severity: auditSeveritySchema.optional(),
  from: isoTimestampSchema.optional(),
  to: isoTimestampSchema.optional(),
  page: z.int().min(1).optional(),
  pageSize: z.int().min(1).max(200).optional(),
});

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

export interface Page<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}
