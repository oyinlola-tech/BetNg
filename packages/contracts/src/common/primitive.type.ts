import { z } from "@zudojs/validation";
import { CURRENCY } from "../runtime.js";

declare const brand: unique symbol;

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

export const uuidSchema = z.uuid();

export function brandedIdSchema<Name extends string>(): z.ZodType<
  Branded<Name>
> {
  return uuidSchema as unknown as z.ZodType<Branded<Name>>;
}

export function asId<Name extends string>(value: string): Branded<Name> {
  return value as Branded<Name>;
}

export const isoTimestampSchema = z.iso.datetime();

export type IsoTimestamp = string;

/**
 * A monetary amount in minor units (kobo), as an integer.
 *
 * BetNG never represents money as a float. Every balance, stake and payout
 * in this project is simulated and carries no real-world value.
 */
export const minorUnitsSchema = z.int();

export type MinorUnits = number;

export { CURRENCY } from "../runtime.js";
export type { Currency } from "../runtime.js";

export const currencySchema = z.literal(CURRENCY);

/**
 * Decimal odds: `2.5` means a one-unit stake returns 2.5 units in total.
 *
 * Bounded below by 1 because odds of 1.0 or less can never return a profit.
 */
export const decimalOddsSchema = z.number().gt(1).max(1000);

export type DecimalOdds = number;
