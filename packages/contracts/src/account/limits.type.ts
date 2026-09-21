import { z } from "@zudojs/validation";
import { isoTimestampSchema } from "../common/index.js";

// Pending backend: responsible gaming limits, enforced by the wallet and betting services.

export const limitKindSchema = z.enum(["deposit_daily", "deposit_weekly", "deposit_monthly", "loss_daily", "loss_weekly", "session_minutes"]);

export type LimitKind = z.infer<typeof limitKindSchema>;

/** `requested` changes wait out a cooling-off period when they loosen a limit; tightening applies at once. */
export const limitStatusSchema = z.enum(["requested", "active", "pending", "expired"]);

export type LimitStatus = z.infer<typeof limitStatusSchema>;

export interface ResponsibleGamingLimit {
  readonly kind: LimitKind;
  readonly status: LimitStatus;
  /** Minor units for money limits, minutes for `session_minutes`. */
  readonly value: number;
  readonly used?: number | undefined;
  readonly resetsAt?: string | undefined;
  readonly effectiveAt: string;
  readonly pendingValue?: number | undefined;
  readonly pendingEffectiveAt?: string | undefined;
}

export const responsibleGamingLimitSchema = z.object({
  kind: limitKindSchema,
  status: limitStatusSchema,
  value: z.int().min(0),
  used: z.int().min(0).optional(),
  resetsAt: isoTimestampSchema.optional(),
  effectiveAt: isoTimestampSchema,
  pendingValue: z.int().min(0).optional(),
  pendingEffectiveAt: isoTimestampSchema.optional(),
});

export const setLimitRequestSchema = z.object({ kind: limitKindSchema, value: z.int().min(1) });

export type SetLimitRequest = z.infer<typeof setLimitRequestSchema>;

export const selfExclusionPeriodSchema = z.enum(["24h", "7d", "30d", "6m", "permanent"]);

export type SelfExclusionPeriod = z.infer<typeof selfExclusionPeriodSchema>;

export interface SelfExclusion {
  readonly active: boolean;
  readonly period?: SelfExclusionPeriod | undefined;
  readonly startedAt?: string | undefined;
  readonly endsAt?: string | undefined;
  readonly canCancelAt?: string | undefined;
}

export const selfExclusionSchema = z.object({
  active: z.boolean(),
  period: selfExclusionPeriodSchema.optional(),
  startedAt: isoTimestampSchema.optional(),
  endsAt: isoTimestampSchema.optional(),
  canCancelAt: isoTimestampSchema.optional(),
});

export const selfExcludeRequestSchema = z.object({ period: selfExclusionPeriodSchema, password: z.string().min(1).max(128) });

export type SelfExcludeRequest = z.infer<typeof selfExcludeRequestSchema>;

export interface LimitHistoryEntry {
  readonly id: string;
  readonly kind: LimitKind | "self_exclude";
  readonly action: "SET" | "RAISED" | "LOWERED" | "REMOVED" | "EXPIRED" | "EXCLUDED";
  readonly previousValue?: number | undefined;
  readonly value?: number | undefined;
  readonly at: string;
}

export const limitHistoryEntrySchema = z.object({
  id: z.string().min(1),
  kind: z.union([limitKindSchema, z.literal("self_exclude")]),
  action: z.enum(["SET", "RAISED", "LOWERED", "REMOVED", "EXPIRED", "EXCLUDED"]),
  previousValue: z.int().optional(),
  value: z.int().optional(),
  at: isoTimestampSchema,
});

export interface LimitsSummary {
  readonly limits: readonly ResponsibleGamingLimit[];
  readonly selfExclusion: SelfExclusion;
  /** True while the account may not bet or deposit. */
  readonly restricted: boolean;
}

export const limitsSummarySchema = z.object({
  limits: z.array(responsibleGamingLimitSchema),
  selfExclusion: selfExclusionSchema,
  restricted: z.boolean(),
});
