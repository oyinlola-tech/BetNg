import { transactionQuerySchema, transactionStatusSchema } from "@betng/contracts";
import { z } from "@zudojs/validation";
import {
  CREDIT_TYPES,
  DEBIT_TYPES,
  DEFAULT_LIST_LIMIT,
  DEFAULT_PAGE_SIZE,
  ENTRY_STATUS,
  LEDGER_ENTRY_TYPES,
  MAX_LIST_LIMIT,
  MAX_PAGE,
  OWNER_TYPES,
  SHOP_ENTRY_TYPES,
} from "../constants/index.js";
import type { LedgerEntryType } from "../interfaces/index.js";

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

const commaList = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");

const LEDGER_TYPES: ReadonlySet<string> = new Set<LedgerEntryType>(LEDGER_ENTRY_TYPES);

const STATUSES: ReadonlySet<string> = new Set(transactionStatusSchema.options);

/** The contract's query, strict, with its two comma lists checked against fixed allowlists. */
export const transactionPageQuerySchema = transactionQuerySchema
  .strict()
  .superRefine((query, context) => {
    if (query.page !== undefined && query.page > MAX_PAGE) {
      context.addIssue({ code: "custom", path: ["page"], message: `Must be at most ${String(MAX_PAGE)}.` });
    }

    if (commaList(query.types).some((type) => !LEDGER_TYPES.has(type))) {
      context.addIssue({ code: "custom", path: ["types"], message: "Contains an unknown transaction type." });
    }

    if (commaList(query.statuses).some((status) => !STATUSES.has(status))) {
      context.addIssue({ code: "custom", path: ["statuses"], message: "Contains an unknown status." });
    }
  })
  .transform((query) => {
    const types = commaList(query.types) as LedgerEntryType[];
    const statuses = commaList(query.statuses);

    return {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? DEFAULT_PAGE_SIZE,
      types: types.length === 0 ? undefined : types,
      includesCompleted: statuses.length === 0 || statuses.includes(ENTRY_STATUS),
      from: query.from === undefined ? undefined : new Date(query.from),
      to: query.to === undefined ? undefined : new Date(query.to),
      search: query.search === undefined || query.search === "" ? undefined : query.search,
      sort: query.sort ?? "createdAt",
      direction: query.direction ?? "desc",
    };
  });

export type TransactionPageRequest = z.infer<typeof transactionPageQuerySchema>;

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
