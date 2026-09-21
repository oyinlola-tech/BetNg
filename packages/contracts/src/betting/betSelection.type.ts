import { z } from "@zudojs/validation";
import {
  brandedIdSchema,
  decimalOddsSchema,
  type MarketId,
  type MatchId,
  type SelectionId,
} from "../common/index.js";

export interface BetSelection {
  readonly matchId: MatchId;
  readonly marketId: MarketId;
  readonly selectionId: SelectionId;
  /**
   * The price at the moment the bet was accepted.
   *
   * Captured on the bet rather than read back from the odds service at
   * settlement time, so a later re-price cannot change what was agreed.
   */
  readonly odds: number;
  /** The market version the price was accepted at. Set by the platform. */
  readonly oddsVersion?: number | undefined;
  readonly selectionCode?: string | undefined;
  readonly line?: number | undefined;
  readonly matchLabel?: string | undefined;
  readonly leagueName?: string | undefined;
  readonly kickoffAt?: string | undefined;
  readonly result?: string | undefined;
  /** Denormalised labels, written by the betting service at acceptance so a
   *  bet reads correctly even after the match's markets are gone. */
  readonly marketType?: string | undefined;
  readonly marketLabel?: string | undefined;
  readonly selectionLabel?: string | undefined;
  /** Set by settlement. */
  readonly outcome?: "PENDING" | "WON" | "LOST" | "VOID" | undefined;
}

export const betSelectionSchema = z.object({
  matchId: brandedIdSchema<"MatchId">(),
  marketId: brandedIdSchema<"MarketId">(),
  selectionId: brandedIdSchema<"SelectionId">(),
  odds: decimalOddsSchema,
  oddsVersion: z.int().min(1).optional(),
  selectionCode: z.string().max(32).optional(),
  line: z.number().optional(),
  matchLabel: z.string().max(160).optional(),
  leagueName: z.string().max(120).optional(),
  kickoffAt: z.iso.datetime().optional(),
  result: z.string().max(16).optional(),
  marketType: z.string().max(32).optional(),
  marketLabel: z.string().max(64).optional(),
  selectionLabel: z.string().max(64).optional(),
  outcome: z.enum(["PENDING", "WON", "LOST", "VOID"]).optional(),
});
