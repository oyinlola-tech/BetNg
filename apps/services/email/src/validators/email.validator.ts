import { z } from "@zudojs/validation";
import { LIMITS } from "../constants/index.js";

// `.strict()` makes an unknown key a validation failure instead of silently dropping it.

const address = z
  .string()
  .trim()
  .toLowerCase()
  .max(LIMITS.ADDRESS_MAX)
  .regex(/^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/u, "Not an email address.");

const idempotencyKey = z
  .string()
  .trim()
  .min(LIMITS.IDEMPOTENCY_KEY_MIN)
  .max(LIMITS.IDEMPOTENCY_KEY_MAX)
  .regex(/^[A-Za-z0-9_.:-]+$/u);

/**
 * A flat string map. Nested values are refused rather than coerced, so nothing can smuggle an object
 * into a rendered page, and a CR or LF is refused so nothing can inject a mail header.
 */
const variables = z
  .record(
    z.string().min(1).max(LIMITS.TEMPLATE_MAX),
    z.string().max(LIMITS.VARIABLE_VALUE_MAX).refine((value) => !/[\r\n]/u.test(value), "Must not span lines."),
  )
  .refine((value) => Object.keys(value).length <= LIMITS.VARIABLES_MAX, "Too many variables.");

export const sendEmailPayloadValidator = z
  .object({
    to: address,
    template: z.string().trim().min(1).max(LIMITS.TEMPLATE_MAX),
    variables: variables.default({}),
    idempotencyKey,
    tags: z.array(z.string().trim().min(1).max(LIMITS.TAG_MAX)).max(LIMITS.TAGS_MAX).optional(),
    replyTo: address.optional(),
  })
  .strict();

export type SendEmailPayload = z.infer<typeof sendEmailPayloadValidator>;

export const messageStatusPayloadValidator = z.object({ id: z.uuid() }).strict();
