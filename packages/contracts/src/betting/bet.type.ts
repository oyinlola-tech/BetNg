/**
 * Bet contracts, owned by the betting service.
 *
 * Every stake and payout in BetNG is simulated. Nothing here models real
 * money, a payment instrument or a real-world obligation.
 */

import { z } from "@zudojs/validation";
import {
  brandedIdSchema,
  currencySchema,
  decimalOddsSchema,
  isoTimestampSchema,
  minorUnitsSchema,
  type BetId,
  type Currency,
  type UserId,
} from "../common/index.js";
import { betSelectionSchema, type BetSelection } from "./betSelection.type.js";

/** What a bet is currently worth to its holder. */
export const betStatusSchema = z.enum(["PENDING", "WON", "LOST", "VOID"]);

export type BetStatus = z.infer<typeof betStatusSchema>;

export interface Bet {
  readonly id: BetId;
  readonly userId: UserId;
  /** One selection is a single; more than one is an accumulator. */
  readonly selections: readonly BetSelection[];
  /** Simulated stake in minor units. */
  readonly stake: number;
  readonly currency: Currency;
  /** Product of every selection's odds, rounded to two decimal places. */
  readonly totalOdds: number;
  /** Simulated payout if every selection wins, in minor units. */
  readonly potentialPayout: number;
  readonly status: BetStatus;
  readonly placedAt: string;
  /** Set when the settlement service resolved this bet. */
  readonly settledAt?: string;
}

export const betSchema = z.object({
  id: brandedIdSchema<"BetId">(),
  userId: brandedIdSchema<"UserId">(),
  selections: z.array(betSelectionSchema).min(1).max(20),
  stake: minorUnitsSchema.min(1),
  currency: currencySchema,
  totalOdds: decimalOddsSchema,
  potentialPayout: minorUnitsSchema.min(1),
  status: betStatusSchema,
  placedAt: isoTimestampSchema,
  settledAt: isoTimestampSchema.optional(),
});

/** The body of `POST /api/v1/bets`. */
export const placeBetRequestSchema = z.object({
  userId: brandedIdSchema<"UserId">(),
  selections: z.array(betSelectionSchema).min(1).max(20),
  stake: minorUnitsSchema.min(1),
  currency: currencySchema.default("NGN"),
});

export type PlaceBetRequest = z.infer<typeof placeBetRequestSchema>;

export const listBetsQuerySchema = z.object({
  userId: brandedIdSchema<"UserId">().optional(),
  status: betStatusSchema.optional(),
});

export type ListBetsQuery = z.infer<typeof listBetsQuerySchema>;
