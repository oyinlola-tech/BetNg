import { z } from "@zudojs/validation";
import {
  brandedIdSchema,
  decimalOddsSchema,
  type MarketId,
  type SelectionId,
} from "../common/index.js";

export interface Selection {
  readonly id: SelectionId;
  readonly marketId: MarketId;
  readonly code: string;
  readonly label: string;
  readonly odds: number;
  readonly probability: number;
}

export const selectionSchema = z.object({
  id: brandedIdSchema<"SelectionId">(),
  marketId: brandedIdSchema<"MarketId">(),
  code: z.string().min(1).max(32),
  label: z.string().min(1).max(64),
  odds: decimalOddsSchema,
  probability: z.number().min(0).max(1),
});
