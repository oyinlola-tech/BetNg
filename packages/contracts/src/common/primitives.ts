/**
 * Primitive contract types shared by every BetNG domain.
 *
 * Identifiers are UUID strings on the wire. They are branded in TypeScript so
 * a `MatchId` cannot silently be passed where a `BetId` is expected, but the
 * brand is a compile-time device only: the JSON representation is a plain
 * string, which keeps the contract language independent.
 */

import { z } from "@zudojs/validation";

declare const brand: unique symbol;

/** Attaches a compile-time-only tag to a string id. */
export type Branded<Name extends string> = string & { readonly [brand]: Name };

export type LeagueId = Branded<"LeagueId">;
export type TeamId = Branded<"TeamId">;
export type FixtureId = Branded<"FixtureId">;
export type MatchId = Branded<"MatchId">;
export type MatchEventId = Branded<"MatchEventId">;
export type MarketId = Branded<"MarketId">;
export type SelectionId = Branded<"SelectionId">;
export type BetId = Branded<"BetId">;
export type UserId = Branded<"UserId">;
export type WalletId = Branded<"WalletId">;
export type TransactionId = Branded<"TransactionId">;
export type SettlementId = Branded<"SettlementId">;

/** A UUID on the wire. */
export const uuidSchema = z.uuid();

/** Builds a branded-id schema. The runtime check is "is this a UUID". */
export function brandedIdSchema<T extends string>(): z.ZodType<Branded<T>> {
  return uuidSchema as unknown as z.ZodType<Branded<T>>;
}

/** An ISO-8601 instant in UTC, e.g. `2026-09-20T15:04:05.000Z`. */
export const isoTimestampSchema = z.iso.datetime();
export type IsoTimestamp = string;

/**
 * A monetary amount in minor units (kobo), as an integer.
 *
 * BetNG never represents money as a float. All balances, stakes and payouts
 * in this project are simulated and carry no real-world value.
 */
export const minorUnitsSchema = z.int();
export type MinorUnits = number;

/** The single currency this simulation uses. */
export const CURRENCY = "NGN" as const;
export const currencySchema = z.literal(CURRENCY);
export type Currency = typeof CURRENCY;

/**
 * Decimal odds, e.g. `2.5` means a 1-unit stake returns 2.5 units in total.
 *
 * Bounded below by 1.01 because odds of 1.0 or less can never return a profit.
 */
export const decimalOddsSchema = z.number().gt(1).max(1000);
export type DecimalOdds = number;
