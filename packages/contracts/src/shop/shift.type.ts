import { z } from "@zudojs/validation";
import { isoTimestampSchema, minorUnitsSchema } from "../common/index.js";

// Pending backend: cashier shifts and the cash drawer. Every total here is computed by the platform from its ledger.

export const shiftStatusSchema = z.enum(["OPEN", "CLOSING", "CLOSED", "RECONCILED"]);

export type ShiftStatus = z.infer<typeof shiftStatusSchema>;

export interface ShiftTotals {
  readonly openingFloat: number;
  readonly sales: number;
  readonly payouts: number;
  readonly cancellations: number;
  readonly cashIn: number;
  readonly cashOut: number;
  /** What the drawer should hold, per the platform ledger. */
  readonly expectedCash: number;
  readonly ticketsSold: number;
}

export const shiftTotalsSchema = z.object({
  openingFloat: minorUnitsSchema.min(0),
  sales: minorUnitsSchema.min(0),
  payouts: minorUnitsSchema.min(0),
  cancellations: minorUnitsSchema.min(0),
  cashIn: minorUnitsSchema.min(0),
  cashOut: minorUnitsSchema.min(0),
  expectedCash: minorUnitsSchema,
  ticketsSold: z.int().min(0),
});

export interface CashierShift {
  readonly id: string;
  readonly cashierId: string;
  readonly cashierName: string;
  readonly status: ShiftStatus;
  readonly openedAt: string;
  readonly closedAt?: string | undefined;
  readonly totals: ShiftTotals;
  readonly countedCash?: number | undefined;
  /** countedCash − expectedCash, from the platform. */
  readonly discrepancy?: number | undefined;
  readonly discrepancyNote?: string | undefined;
}

export const cashierShiftSchema = z.object({
  id: z.string().min(1),
  cashierId: z.string().min(1),
  cashierName: z.string().max(60),
  status: shiftStatusSchema,
  openedAt: isoTimestampSchema,
  closedAt: isoTimestampSchema.optional(),
  totals: shiftTotalsSchema,
  countedCash: minorUnitsSchema.min(0).optional(),
  discrepancy: minorUnitsSchema.optional(),
  discrepancyNote: z.string().max(300).optional(),
});

export const openShiftRequestSchema = z.object({ openingFloat: minorUnitsSchema.min(0) });

export type OpenShiftRequest = z.infer<typeof openShiftRequestSchema>;

export const cashMovementRequestSchema = z.object({
  type: z.enum(["CASH_IN", "CASH_OUT"]),
  amount: minorUnitsSchema.min(1),
  note: z.string().min(3).max(160),
});

export type CashMovementRequest = z.infer<typeof cashMovementRequestSchema>;

/**
 * One cashier handing float to another in the same shop. The shop's balance does not move; each drawer's
 * expected cash does. The sender re-enters their PIN, as they do to pay out a ticket.
 */
export const floatTransferRequestSchema = z.object({
  toCashierId: z.string().min(1),
  amount: minorUnitsSchema.min(1),
  note: z.string().trim().min(3).max(160),
  pin: z.string().regex(/^\d{4,6}$/),
});

export type FloatTransferRequest = z.infer<typeof floatTransferRequestSchema>;

export const floatTransferSchema = z.object({
  id: z.string().min(1),
  fromCashierId: z.string().min(1),
  fromCashierName: z.string().max(60),
  toCashierId: z.string().min(1),
  toCashierName: z.string().max(60),
  amount: minorUnitsSchema.min(1),
  note: z.string().max(160),
  createdAt: isoTimestampSchema,
});

export type FloatTransfer = z.infer<typeof floatTransferSchema>;

/** Denominations counted in the drawer; the platform totals them. */
export const closeShiftRequestSchema = z.object({
  counted: z.array(z.object({ denomination: minorUnitsSchema.min(1), count: z.int().min(0).max(100_000) })).min(1),
  note: z.string().max(300).optional(),
  pin: z.string().regex(/^\d{4,6}$/),
});

export type CloseShiftRequest = z.infer<typeof closeShiftRequestSchema>;

export const NGN_DENOMINATIONS: readonly number[] = [100_000, 50_000, 20_000, 10_000, 5_000, 2_000, 1_000, 500];
