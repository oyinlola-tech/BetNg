// `.strict()` makes an unknown key a validation failure instead of silently dropping it.

import {
  adminActivateRequestSchema,
  adminActivationStartSchema,
  adminLoginRequestSchema,
  adminPasswordResetRequestSchema,
  adminUpdateCustomerRequestSchema,
  auditLogQuerySchema,
  auditSeveritySchema,
  createAdminRequestSchema,
  createCashierRequestSchema,
  createShopRequestSchema,
  shopApplicationDecisionSchema,
  shopApplicationRequestSchema,
  shopApplicationStatusSchema,
  shopApplicationVerifyRequestSchema,
  customerLoginRequestSchema,
  customerRegisterRequestSchema,
  notificationKindSchema,
  passwordResetRequestSchema,
  platformSettingsSchema,
  shopLoginRequestSchema,
  updateAdminRequestSchema,
  verifyEmailRequestSchema,
} from "@betng/contracts";
import { z } from "@zudojs/validation";
import { NOTIFICATION } from "../constants/index.js";

const reason = z.string().trim().min(4).max(240);

export const registerCustomerValidator = customerRegisterRequestSchema.strict();
export const loginCustomerValidator = customerLoginRequestSchema.strict();
export const verifyEmailValidator = verifyEmailRequestSchema.strict();
export const emailOnlyValidator = passwordResetRequestSchema.strict();
export const loginCashierValidator = shopLoginRequestSchema.strict();
export const loginAdminValidator = adminLoginRequestSchema.strict();

export const idParamValidator = z.uuid();

export const listCustomersQueryValidator = z.strictObject({
  q: z.string().trim().min(1).max(80).optional(),
});

export const statusChangeValidator = z.strictObject({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  reason,
});

export const adminUpdateCustomerValidator = adminUpdateCustomerRequestSchema.strict();

export const adminPasswordResetValidator = adminPasswordResetRequestSchema.strict();

export const createAdminValidator = createAdminRequestSchema.strict();

export const updateAdminValidator = updateAdminRequestSchema
  .strict()
  .refine((value) => value.name !== undefined || value.role !== undefined, {
    message: "Send at least one field to change.",
  });

export const adminActivationStartValidator = adminActivationStartSchema.strict();

export const adminActivateValidator = adminActivateRequestSchema.strict();

export const shopApplicationValidator = shopApplicationRequestSchema.strict();

export const shopApplicationVerifyValidator = shopApplicationVerifyRequestSchema.strict();

export const shopApplicationStatusQueryValidator = z.object({ email: z.email().max(254) }).strict();

export const shopApplicationQueueQueryValidator = z
  .object({ status: shopApplicationStatusSchema.optional() })
  .strict();

export const shopApplicationDecisionValidator = shopApplicationDecisionSchema
  .strict()
  .refine((value) => value.decision === "APPROVE" || (value.shopCode === undefined && value.shopName === undefined), {
    message: "A shop code or name can only be set when approving.",
  });

export const applicationReferenceValidator = z.string().trim().regex(/^BNGA-[0-9A-HJ-NP-Z]{16,}$/u);

export const createShopValidator = createShopRequestSchema.strict();

export const updateShopValidator = createShopRequestSchema
  .partial()
  .extend({ reason: reason.optional() })
  .strict()
  .refine((value) => Object.keys(value).some((key) => key !== "reason"), {
    message: "Send at least one field to change.",
  });

export const createCashierValidator = createCashierRequestSchema
  .extend({ username: z.string().trim().regex(/^[A-Za-z0-9._-]{2,40}$/u) })
  .strict();

export const updateSettingsValidator = platformSettingsSchema
  .partial()
  .extend({ reason })
  .strict()
  .refine((value) => Object.keys(value).some((key) => key !== "reason"), {
    message: "Send at least one setting to change.",
  });

const pageNumber = z.coerce.number().int().min(1).max(100_000);

export const auditLogQueryValidator = z.strictObject({
  actor: z.string().trim().min(1).max(80).optional(),
  action: z.string().trim().min(1).max(80).optional(),
  resource: z.string().trim().min(1).max(160).optional(),
  severity: auditLogQuerySchema.shape.severity,
  from: auditLogQuerySchema.shape.from,
  to: auditLogQuerySchema.shape.to,
  page: pageNumber.optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
});

export const authenticatePayloadValidator = z.strictObject({
  token: z.string().min(16).max(512),
});

export const verifyCashierPinPayloadValidator = z.strictObject({
  cashierId: z.uuid(),
  pin: z.string().regex(/^\d{4,6}$/u),
});

/** Python callers serialise an absent optional as `null`, so both spellings are accepted. */
export const recordAuditPayloadValidator = z.strictObject({
  actorId: z.string().trim().min(1).max(80),
  actorRole: z.string().trim().min(1).max(40),
  actorName: z.string().trim().min(1).max(80).nullish(),
  action: z.string().trim().min(1).max(80).regex(/^[a-z0-9_.:-]+$/u),
  entityType: z.string().trim().min(1).max(80),
  entityId: z.string().trim().min(1).max(80),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  reason: z.string().trim().max(240).nullish(),
  severity: auditSeveritySchema.nullish(),
  requestId: z.string().trim().max(64).nullish(),
});

function fitsNotificationData(data: Readonly<Record<string, unknown>>): boolean {
  return Buffer.byteLength(JSON.stringify(data), "utf8") <= NOTIFICATION.DATA_MAX_BYTES;
}

export const notifyPayloadValidator = z.strictObject({
  customerId: z.uuid(),
  kind: notificationKindSchema,
  title: z.string().trim().min(1).max(NOTIFICATION.TITLE_MAX),
  body: z.string().trim().max(NOTIFICATION.BODY_MAX),
  data: z
    .record(z.string(), z.unknown())
    .refine(fitsNotificationData, `Must serialise to at most ${String(NOTIFICATION.DATA_MAX_BYTES)} bytes.`)
    .nullish(),
  dedupeKey: z
    .string()
    .min(1)
    .max(NOTIFICATION.DEDUPE_KEY_MAX)
    .regex(/^[A-Za-z0-9._:-]+$/u)
    .nullish(),
});

export const listNotificationsQueryValidator = z.strictObject({
  limit: z.coerce.number().int().min(1).max(NOTIFICATION.LIST_MAX).default(NOTIFICATION.LIST_DEFAULT),
});

export const markNotificationsReadValidator = z.strictObject({
  ids: z.array(z.uuid()).max(NOTIFICATION.MARK_READ_MAX_IDS).optional(),
});
