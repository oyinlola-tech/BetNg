import { z } from "@zudojs/validation";
import {
  brandedIdSchema,
  isoTimestampSchema,
  type FixtureId,
  type LeagueId,
  type TeamId,
} from "../common/index.js";

export interface Fixture {
  readonly id: FixtureId;
  readonly leagueId: LeagueId;
  readonly season?: number | undefined;
  readonly matchday: number;
  readonly homeTeamId: TeamId;
  readonly awayTeamId: TeamId;
  readonly kickoffAt: string;
  readonly bettingClosesAt: string;
  readonly createdAt: string;
}

export const fixtureSchema = z.object({
  id: brandedIdSchema<"FixtureId">(),
  leagueId: brandedIdSchema<"LeagueId">(),
  season: z.int().min(1).optional(),
  matchday: z.int().min(1),
  homeTeamId: brandedIdSchema<"TeamId">(),
  awayTeamId: brandedIdSchema<"TeamId">(),
  kickoffAt: isoTimestampSchema,
  bettingClosesAt: isoTimestampSchema,
  createdAt: isoTimestampSchema,
});
