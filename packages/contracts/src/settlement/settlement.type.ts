import { z } from "@zudojs/validation";
import {
  brandedIdSchema,
  currencySchema,
  isoTimestampSchema,
  minorUnitsSchema,
  type BetId,
  type Currency,
  type MatchId,
  type SelectionId,
  type SettlementId,
} from "../common/index.js";

export const settlementOutcomeSchema = z.enum(["WON", "LOST", "VOID"]);

export type SettlementOutcome = z.infer<typeof settlementOutcomeSchema>;

export interface SettledSelection {
  readonly selectionId: SelectionId;
  readonly matchId: MatchId;
  readonly outcome: SettlementOutcome;
}

export const settledSelectionSchema = z.object({
  selectionId: brandedIdSchema<"SelectionId">(),
  matchId: brandedIdSchema<"MatchId">(),
  outcome: settlementOutcomeSchema,
});

export interface Settlement {
  readonly id: SettlementId;
  readonly betId: BetId;
  readonly outcome: SettlementOutcome;
  readonly selections: readonly SettledSelection[];
  readonly payout: number;
  readonly currency: Currency;
  readonly settledAt: string;
}

export const settlementSchema = z.object({
  id: brandedIdSchema<"SettlementId">(),
  betId: brandedIdSchema<"BetId">(),
  outcome: settlementOutcomeSchema,
  selections: z.array(settledSelectionSchema).min(1),
  payout: minorUnitsSchema.min(0),
  currency: currencySchema,
  settledAt: isoTimestampSchema,
});
