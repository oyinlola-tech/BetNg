import { z } from "@zudojs/validation";
import {
  brandedIdSchema,
  isoTimestampSchema,
  type LeagueId,
  type TeamId,
} from "../common/index.js";

export const leagueStatusSchema = z.enum(["ACTIVE", "SUSPENDED", "ARCHIVED"]);

export type LeagueStatus = z.infer<typeof leagueStatusSchema>;

export interface League {
  readonly id: LeagueId;
  readonly name: string;
  readonly code: string;
  /** URL-safe identifier such as `premier-league`. Admin-configured; clients never hard-code it. */
  readonly slug?: string | undefined;
  readonly sport?: string | undefined;
  readonly status?: LeagueStatus | undefined;
  readonly country: string;
  readonly createdAt: string;
}

export const leagueSchema = z.object({
  id: brandedIdSchema<"LeagueId">(),
  name: z.string().min(1).max(120),
  code: z.string().min(2).max(8),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(40)
    .optional(),
  sport: z.string().max(32).optional(),
  status: leagueStatusSchema.optional(),
  country: z.string().min(2).max(60),
  createdAt: isoTimestampSchema,
});

export interface Team {
  readonly id: TeamId;
  readonly leagueId: LeagueId;
  readonly name: string;
  readonly shortName: string;
  /**
   * The team's simulated strength, 0 to 100.
   *
   * The simulation service reads it as one input to match probability. It is
   * a property of the team, never of an individual bettor's position.
   */
  readonly strength: number;
  /** Home city, for a team page. */
  readonly city?: string | undefined;
  readonly stadium?: string | undefined;
  /** Kit colours as CSS hex, for a generated badge. Optional until the match service carries them. */
  readonly colors?: TeamColors | undefined;
  readonly createdAt: string;
}

/** Kit colours a client draws a badge with. */
export interface TeamColors {
  readonly primary: string;
  readonly secondary: string;
}

export const teamColorsSchema = z.object({
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const teamSchema = z.object({
  id: brandedIdSchema<"TeamId">(),
  leagueId: brandedIdSchema<"LeagueId">(),
  name: z.string().min(1).max(120),
  shortName: z.string().min(2).max(8),
  strength: z.number().min(0).max(100),
  city: z.string().max(60).optional(),
  stadium: z.string().max(80).optional(),
  colors: teamColorsSchema.optional(),
  createdAt: isoTimestampSchema,
});
