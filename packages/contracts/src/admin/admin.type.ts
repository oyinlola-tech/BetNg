import { z } from "@zudojs/validation";
import { brandedIdSchema, isoTimestampSchema, minorUnitsSchema, type Branded, type MatchId } from "../common/index.js";
import { healthStatusSchema } from "../common/index.js";

export type AdminId = Branded<"AdminId">;

export const adminRoleSchema = z.enum(["SUPER_ADMIN", "OPERATIONS", "RISK_ANALYST", "SUPPORT"]);

export type AdminRole = z.infer<typeof adminRoleSchema>;

export interface AdminUser {
  readonly id: AdminId;
  readonly email: string;
  readonly displayName: string;
  readonly role: AdminRole;
  readonly twoFactorEnabled: boolean;
  readonly lastLoginAt?: string | undefined;
}

export const adminUserSchema = z.object({
  id: brandedIdSchema<"AdminId">(),
  email: z.email(),
  displayName: z.string().max(60),
  role: adminRoleSchema,
  twoFactorEnabled: z.boolean(),
  lastLoginAt: isoTimestampSchema.optional(),
});

export const adminLoginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(128),
  /** Six-digit TOTP. Required when the account has 2FA enabled. */
  code: z.string().regex(/^\d{6}$/).optional(),
});

export type AdminLoginRequest = z.infer<typeof adminLoginRequestSchema>;

export interface AdminSession {
  readonly token: string;
  readonly expiresAt: string;
  readonly admin: AdminUser;
}

export const adminSessionSchema = z.object({ token: z.string().min(16), expiresAt: isoTimestampSchema, admin: adminUserSchema });

export interface AuditLogEntry {
  readonly id: string;
  readonly timestamp: string;
  /** `admin:<id>`, `shop:<cashierId>`, or `system`. */
  readonly actor: string;
  readonly actorName: string;
  readonly action: string;
  readonly resource: string;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly ip?: string | undefined;
  readonly requestId: string;
}

export const auditLogEntrySchema = z.object({
  id: z.uuid(),
  timestamp: isoTimestampSchema,
  actor: z.string().max(80),
  actorName: z.string().max(80),
  action: z.string().max(80),
  resource: z.string().max(160),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  ip: z.string().max(45).optional(),
  requestId: z.string().max(64),
});

export interface ServiceHealth {
  readonly service: string;
  readonly status: z.infer<typeof healthStatusSchema>;
  readonly latencyMs: number;
  readonly version: string;
  readonly checkedAt: string;
}

export const serviceHealthSchema = z.object({
  service: z.string().max(40),
  status: healthStatusSchema,
  latencyMs: z.number().min(0),
  version: z.string().max(20),
  checkedAt: isoTimestampSchema,
});

export interface PlatformOverview {
  readonly activeUsers: number;
  readonly activeShops: number;
  readonly openBets: number;
  readonly liveMatches: number;
  readonly todayStake: number;
  readonly todayPayouts: number;
  readonly todayNet: number;
  readonly generatedAt: string;
}

export const platformOverviewSchema = z.object({
  activeUsers: z.int().min(0),
  activeShops: z.int().min(0),
  openBets: z.int().min(0),
  liveMatches: z.int().min(0),
  todayStake: minorUnitsSchema.min(0),
  todayPayouts: minorUnitsSchema.min(0),
  todayNet: minorUnitsSchema,
  generatedAt: isoTimestampSchema,
});

export const matchAdminActionSchema = z.enum(["OPEN_BETTING", "CLOSE_BETTING", "START_SIMULATION", "RERUN_SIMULATION", "VOID_MATCH"]);

export type MatchAdminAction = z.infer<typeof matchAdminActionSchema>;

/** The body of `POST /admin/matches/:id/actions`. */
export const matchAdminActionRequestSchema = z.object({
  action: matchAdminActionSchema,
  reason: z.string().min(4).max(240),
});

export type MatchAdminActionRequest = z.infer<typeof matchAdminActionRequestSchema>;

export interface SimulationRun {
  readonly id: string;
  readonly matchId: MatchId;
  readonly status: "READY" | "RUNNING" | "COMPLETED" | "FAILED";
  readonly startedAt?: string | undefined;
  readonly completedAt?: string | undefined;
  readonly events: number;
  readonly score: { readonly home: number; readonly away: number };
  readonly seed: string;
}

export const simulationRunSchema = z.object({
  id: z.string().max(40),
  matchId: brandedIdSchema<"MatchId">(),
  status: z.enum(["READY", "RUNNING", "COMPLETED", "FAILED"]),
  startedAt: isoTimestampSchema.optional(),
  completedAt: isoTimestampSchema.optional(),
  events: z.int().min(0),
  score: z.object({ home: z.int().min(0), away: z.int().min(0) }),
  seed: z.string().max(80),
});
