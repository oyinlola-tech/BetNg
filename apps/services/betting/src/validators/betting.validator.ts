import {
  betStatusSchema,
  cancelTicketRequestSchema,
  payoutTicketRequestSchema,
  placeBetRequestSchema,
  placeTicketRequestSchema,
  ticketStatusSchema,
} from "@betng/contracts";
import type {
  CancelTicketRequest,
  PayoutTicketRequest,
  PlaceBetRequest,
  PlaceTicketRequest,
} from "@betng/contracts";
import { z } from "@zudojs/validation";
import type { ValidationSchema } from "@zudojs/validation";
import { LIST_LIMIT, MAX_LEGS } from "../constants/index.js";

export const placeBetValidator: ValidationSchema<PlaceBetRequest> =
  placeBetRequestSchema;

export const placeTicketValidator: ValidationSchema<PlaceTicketRequest> =
  placeTicketRequestSchema;

export const payoutTicketValidator: ValidationSchema<PayoutTicketRequest> =
  payoutTicketRequestSchema;

export const cancelTicketValidator: ValidationSchema<CancelTicketRequest> =
  cancelTicketRequestSchema;

export const uuidValidator = z.uuid();

export const idempotencyKeyValidator = z
  .string()
  .regex(/^[A-Za-z0-9_.:-]{8,120}$/);

export const ticketCodeValidator = z
  .string()
  .max(16)
  .transform((code) => code.trim().toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9]{10,12}$/));

export const listBetsQueryValidator = z.object({
  userId: z.uuid().optional(),
  status: betStatusSchema.optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(LIST_LIMIT.betsMax)
    .default(LIST_LIMIT.betsDefault),
});

export type ListBetsQueryInput = z.infer<typeof listBetsQueryValidator>;

function isCalendarDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export const listTicketsQueryValidator = z.object({
  status: ticketStatusSchema.optional(),
  q: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[\p{L}\p{N} +.'-]+$/u)
    .optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(isCalendarDate)
    .optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(LIST_LIMIT.ticketsMax)
    .default(LIST_LIMIT.ticketsDefault),
});

export type ListTicketsQueryInput = z.infer<typeof listTicketsQueryValidator>;

const settledOutcomeValidator = z.enum(["WON", "LOST", "VOID"]);

export const applySettlementValidator = z.object({
  betId: z.uuid(),
  outcome: settledOutcomeValidator,
  payout: z.int().min(0),
  legs: z
    .array(
      z.object({
        selectionId: z.uuid(),
        outcome: settledOutcomeValidator,
        result: z.string().max(16).nullish(),
      }),
    )
    .max(MAX_LEGS),
  settledAt: z.iso.datetime({ offset: true }),
});

export type ApplySettlementInput = z.infer<typeof applySettlementValidator>;
