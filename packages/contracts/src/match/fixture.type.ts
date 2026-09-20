/**
 * Fixture contracts, owned by the match service.
 *
 * A fixture is the scheduled pairing; a {@link Match} is the instance of it
 * that gets played.
 */

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
  /** One-based season number. Optional until the match service tracks seasons. */
  readonly season?: number | undefined;
  /** One-based matchday within the league's season. */
  readonly matchday: number;
  readonly homeTeamId: TeamId;
  readonly awayTeamId: TeamId;
  readonly kickoffAt: string;
  /** After this instant the betting service rejects new bets. */
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
