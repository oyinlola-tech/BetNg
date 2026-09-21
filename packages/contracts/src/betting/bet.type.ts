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

export const betStatusSchema = z.enum([
  "PENDING",
  "WON",
  "LOST",
  "VOID",
  "CANCELLED",
]);

export const betChannelSchema = z.enum(["ONLINE", "SHOP"]);

export type BetChannel = z.infer<typeof betChannelSchema>;

export type BetStatus = z.infer<typeof betStatusSchema>;

export interface Bet {
  readonly id: BetId;
  readonly userId: UserId;
  readonly selections: readonly BetSelection[];
  readonly stake: number;
  readonly currency: Currency;
  readonly totalOdds: number;
  readonly potentialPayout: number;
  readonly status: BetStatus;
  readonly placedAt: string;
  readonly settledAt?: string;
  /** The amount actually paid, in minor units, once settled. Zero for a loss. */
  readonly payout?: number | undefined;
  readonly channel?: BetChannel | undefined;
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
  payout: minorUnitsSchema.min(0).optional(),
  channel: betChannelSchema.optional(),
});

export const placeBetRequestSchema = z.object({
  /** Ignored by the platform: the bettor is the authenticated actor. */
  userId: brandedIdSchema<"UserId">().optional(),
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
