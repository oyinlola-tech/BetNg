import { z } from "@zudojs/validation";
import {
  CREDIT_TYPES,
  DEBIT_TYPES,
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  OWNER_TYPES,
  SHOP_ENTRY_TYPES,
} from "../constants/index.js";

const SHOP_TYPES: readonly string[] = SHOP_ENTRY_TYPES;

const amountSchema = z
  .int()
  .min(1)
  .refine((value) => Number.isSafeInteger(value), "Must be a safe integer.");

/** Shorter than the column: the service prefixes a client's key with the operation it belongs to. */
const idempotencyKeySchema = z
  .string()
  .min(8)
  .max(100)
  .regex(/^[A-Za-z0-9._:-]+$/, "Use letters, digits and . _ : - only.");

export const ownerIdSchema = z.uuid();

/** `userId` is in the published `DepositRequest`, so it is accepted and ignored: the account is always the actor's own. */
export function createFundsRequestSchema(maxKobo: number) {
  return z.strictObject({
    userId: z.string().max(64).optional(),
    amount: amountSchema.max(maxKobo),
    currency: z.literal("NGN").default("NGN"),
    idempotencyKey: idempotencyKeySchema.optional(),
  });
}

export type FundsRequest = z.infer<ReturnType<typeof createFundsRequestSchema>>;

export const idempotencyHeaderSchema = idempotencyKeySchema;

const limitSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(MAX_LIST_LIMIT)
  .default(DEFAULT_LIST_LIMIT);

export const listQuerySchema = z.strictObject({ limit: limitSchema });

export const shopTransactionsQuerySchema = z.strictObject({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
    .optional(),
  limit: limitSchema,
});

const entryPayloadShape = {
  ownerType: z.enum(OWNER_TYPES),
  ownerId: ownerIdSchema,
  amount: amountSchema,
  idempotencyKey: z.string().min(1).max(120),
  reference: z.string().min(1).max(120).optional(),
  note: z.string().min(1).max(160).optional(),
  actorId: z.string().min(1).max(64).optional(),
};

interface EntryPayloadShape {
  readonly ownerType: (typeof OWNER_TYPES)[number];
  readonly type: string;
  readonly actorId?: string | undefined;
}

/** Counter transactions belong to a shop float and always name their cashier. */
function checkShopEntry(
  payload: EntryPayloadShape,
  context: z.RefinementCtx,
): void {
  if (!SHOP_TYPES.includes(payload.type)) {
    return;
  }

  if (payload.ownerType !== "SHOP") {
    context.addIssue({
      code: "custom",
      path: ["ownerType"],
      message: `${payload.type} can only be posted to a SHOP account.`,
    });
  }

  if (!ownerIdSchema.safeParse(payload.actorId).success) {
    context.addIssue({
      code: "custom",
      path: ["actorId"],
      message: `${payload.type} must name the cashier's id in actorId.`,
    });
  }
}

export const debitPayloadSchema = z
  .strictObject({ ...entryPayloadShape, type: z.enum(DEBIT_TYPES) })
  .superRefine(checkShopEntry);

export const creditPayloadSchema = z
  .strictObject({ ...entryPayloadShape, type: z.enum(CREDIT_TYPES) })
  .superRefine(checkShopEntry);

export type DebitPayload = z.infer<typeof debitPayloadSchema>;

export type CreditPayload = z.infer<typeof creditPayloadSchema>;

export const balancePayloadSchema = z.strictObject({
  ownerType: z.enum(OWNER_TYPES),
  ownerId: ownerIdSchema,
});
