/** Shop-owner applications: submitted from the public site, decided in the admin console. */

import { z } from "@zudojs/validation";
import { brandedIdSchema, isoTimestampSchema, type Branded } from "../common/index.js";

export type ShopApplicationId = Branded<"ShopApplicationId">;

/** Mirrors `kycStatusSchema`, because a shop application is reviewed the same way. */
export const shopApplicationStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED", "REQUIRES_ACTION"]);

export type ShopApplicationStatus = z.infer<typeof shopApplicationStatusSchema>;

export const shopApplicationDocumentTypeSchema = z.enum([
  "CAC_CERTIFICATE",
  "OWNER_ID",
  "PROOF_OF_ADDRESS",
  "PREMISES_PHOTO",
]);

export type ShopApplicationDocumentType = z.infer<typeof shopApplicationDocumentTypeSchema>;

/** Nigerian states, so a shop code can be generated from one and a reviewer sees a known value. */
export const nigerianStateSchema = z.enum([
  "ABIA", "ADAMAWA", "AKWA_IBOM", "ANAMBRA", "BAUCHI", "BAYELSA", "BENUE", "BORNO", "CROSS_RIVER",
  "DELTA", "EBONYI", "EDO", "EKITI", "ENUGU", "FCT", "GOMBE", "IMO", "JIGAWA", "KADUNA", "KANO",
  "KATSINA", "KEBBI", "KOGI", "KWARA", "LAGOS", "NASARAWA", "NIGER", "OGUN", "ONDO", "OSUN", "OYO",
  "PLATEAU", "RIVERS", "SOKOTO", "TARABA", "YOBE", "ZAMFARA",
]);

export type NigerianState = z.infer<typeof nigerianStateSchema>;

const phone = z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/u, "Not a phone number.");

export const shopApplicationRequestSchema = z.object({
  applicantName: z.string().trim().min(2).max(80),
  applicantEmail: z.email().max(254),
  applicantPhone: phone,
  businessName: z.string().trim().min(2).max(80),
  /** CAC registration number; optional, because a sole trader may not have one yet. */
  rcNumber: z.string().trim().regex(/^[A-Za-z0-9/-]{4,20}$/u).optional(),
  address: z.string().trim().min(6).max(160),
  city: z.string().trim().min(2).max(60),
  state: nigerianStateSchema,
  /** What the shop would be called; the reviewer may change it. */
  proposedShopName: z.string().trim().min(2).max(80),
  note: z.string().trim().max(500).optional(),
});

export type ShopApplicationRequest = z.infer<typeof shopApplicationRequestSchema>;

/** What the applicant is told after submitting. The reference is theirs to keep. */
export const shopApplicationReceiptSchema = z.object({
  reference: z.string().min(12).max(40),
  applicantEmail: z.email(),
  verificationRequired: z.literal(true),
  expiresAt: isoTimestampSchema,
});

export type ShopApplicationReceipt = z.infer<typeof shopApplicationReceiptSchema>;

export const shopApplicationVerifyRequestSchema = z.object({
  applicantEmail: z.email(),
  code: z.string().regex(/^\d{6}$/),
});

export type ShopApplicationVerifyRequest = z.infer<typeof shopApplicationVerifyRequestSchema>;

/** The applicant's own view. It carries no reviewer name and no internal id. */
export const shopApplicationStatusViewSchema = z.object({
  reference: z.string(),
  status: shopApplicationStatusSchema,
  businessName: z.string(),
  submittedAt: isoTimestampSchema,
  decidedAt: isoTimestampSchema.optional(),
  /** Present only when the decision needs the applicant to do something, or explains a refusal. */
  reason: z.string().optional(),
  emailVerified: z.boolean(),
});

export type ShopApplicationStatusView = z.infer<typeof shopApplicationStatusViewSchema>;

export const shopApplicationDocumentSchema = z.object({
  id: brandedIdSchema<"ShopApplicationDocumentId">(),
  type: shopApplicationDocumentTypeSchema,
  fileName: z.string().max(200),
  contentType: z.string().max(40),
  sizeBytes: z.int().min(1),
  uploadedAt: isoTimestampSchema,
});

export type ShopApplicationDocument = z.infer<typeof shopApplicationDocumentSchema>;
