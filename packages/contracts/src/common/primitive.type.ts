/**
 * Primitive contract types shared by every BetNG domain.
 *
 * Identifiers are UUID strings on the wire and branded in TypeScript, so a
 * `MatchId` cannot silently be passed where a `BetId` is expected. The brand
 * is a compile-time device only; the JSON representation stays a plain
 * string, which keeps the contract language independent.
 */

import { z } from "@zudojs/validation";

declare const brand: unique symbol;

/** Attaches a compile-time-only tag to a string identifier. */
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

/**
 * Builds a schema for a branded identifier.
 *
 * @returns A schema whose runtime check is "is this a UUID" and whose static
 *   type is the branded identifier.
 */
export function brandedIdSchema<Name extends string>(): z.ZodType<
  Branded<Name>
> {
  return uuidSchema as unknown as z.ZodType<Branded<Name>>;
}

/**
 * Tags a validated UUID string as a branded identifier.
 *
 * @param value - A UUID string that has already been validated.
 * @returns The same string, typed as the branded identifier.
 */
export function asId<Name extends string>(value: string): Branded<Name> {
  return value as Branded<Name>;
}

/** An ISO-8601 instant in UTC, such as `2026-09-20T15:04:05.000Z`. */
export const isoTimestampSchema = z.iso.datetime();

/** An ISO-8601 instant in UTC. */
export type IsoTimestamp = string;

/**
 * A monetary amount in minor units (kobo), as an integer.
 *
 * BetNG never represents money as a float. Every balance, stake and payout
 * in this project is simulated and carries no real-world value.
 */
export const minorUnitsSchema = z.int();

/** A monetary amount in minor units. */
export type MinorUnits = number;

/** The single currency this simulation uses. */
export const CURRENCY = "NGN" as const;

export const currencySchema = z.literal(CURRENCY);

export type Currency = typeof CURRENCY;

/**
 * Decimal odds: `2.5` means a one-unit stake returns 2.5 units in total.
 *
 * Bounded below by 1 because odds of 1.0 or less can never return a profit.
 */
export const decimalOddsSchema = z.number().gt(1).max(1000);

/** Decimal odds. */
export type DecimalOdds = number;
