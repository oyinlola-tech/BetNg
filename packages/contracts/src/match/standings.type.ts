/**
 * League tables and scorer charts, owned by the match service.
 *
 * A projection of completed results, served over
 * `GET /leagues/:id/standings?season=` and `GET /leagues/:id/scorers`.
 */

import { z } from "@zudojs/validation";
import {
  brandedIdSchema,
  type LeagueId,
  type TeamId,
} from "../common/index.js";

export const formResultSchema = z.enum(["W", "D", "L"]);

export type FormResult = z.infer<typeof formResultSchema>;

export interface StandingRow {
  readonly position: number;
  readonly teamId: TeamId;
  readonly played: number;
  readonly won: number;
  readonly drawn: number;
  readonly lost: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly goalDifference: number;
  readonly points: number;
  readonly form: readonly FormResult[];
}

export const standingRowSchema = z.object({
  position: z.int().min(1),
  teamId: brandedIdSchema<"TeamId">(),
  played: z.int().min(0),
  won: z.int().min(0),
  drawn: z.int().min(0),
  lost: z.int().min(0),
  goalsFor: z.int().min(0),
  goalsAgainst: z.int().min(0),
  goalDifference: z.int(),
  points: z.int().min(0),
  form: z.array(formResultSchema).max(5),
});

export interface Standings {
  readonly leagueId: LeagueId;
  readonly season: number;
  readonly matchdaysPlayed: number;
  readonly rows: readonly StandingRow[];
  readonly generatedAt: string;
}

export const standingsSchema = z.object({
  leagueId: brandedIdSchema<"LeagueId">(),
  season: z.int().min(1),
  matchdaysPlayed: z.int().min(0),
  rows: z.array(standingRowSchema),
  generatedAt: z.iso.datetime(),
});

export interface TopScorer {
  readonly player: string;
  readonly teamId: TeamId;
  readonly goals: number;
  readonly assists: number;
}

export const topScorerSchema = z.object({
  player: z.string().min(1).max(80),
  teamId: brandedIdSchema<"TeamId">(),
  goals: z.int().min(0),
  assists: z.int().min(0),
});
