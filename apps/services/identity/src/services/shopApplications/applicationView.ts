import { asId } from "@betng/contracts";
import type { AdminShopApplication, ShopApplicationStatusView } from "@betng/contracts";
import type {
  ShopApplication as ShopApplicationRow,
  ShopApplicationDocument as ShopApplicationDocumentRow,
} from "../../generated/prisma/client.js";

/**
 * What the applicant sees. No internal id, no reviewer, no phone, no address — they typed those and do not
 * need them read back, and an answer that carries less is an answer that leaks less.
 */
export function toShopApplicationStatusView(row: ShopApplicationRow): ShopApplicationStatusView {
  return {
    reference: row.reference,
    status: row.status,
    businessName: row.businessName,
    submittedAt: row.createdAt.toISOString(),
    emailVerified: row.emailVerifiedAt !== null,
    ...(row.decidedAt === null ? {} : { decidedAt: row.decidedAt.toISOString() }),
    // An approval's reason is internal; only a refusal or a request for more is the applicant's business.
    ...(row.reason === null || row.status === "APPROVED" ? {} : { reason: row.reason }),
  };
}

export function toAdminShopApplication(
  row: ShopApplicationRow,
  documents: readonly ShopApplicationDocumentRow[] = [],
): AdminShopApplication {
  return {
    id: asId<"ShopApplicationId">(row.id),
    reference: row.reference,
    status: row.status,
    applicantName: row.applicantName,
    applicantEmail: row.applicantEmail,
    applicantPhone: row.applicantPhone,
    businessName: row.businessName,
    address: row.address,
    city: row.city,
    state: row.state as AdminShopApplication["state"],
    proposedShopName: row.proposedShopName,
    submittedAt: row.createdAt.toISOString(),
    documents: documents.map((document) => ({
      id: asId<"ShopApplicationDocumentId">(document.id),
      type: document.type,
      fileName: document.fileName,
      contentType: document.contentType,
      sizeBytes: document.sizeBytes,
      uploadedAt: document.uploadedAt.toISOString(),
    })),
    ...(row.rcNumber === null ? {} : { rcNumber: row.rcNumber }),
    ...(row.note === null ? {} : { note: row.note }),
    ...(row.emailVerifiedAt === null ? {} : { emailVerifiedAt: row.emailVerifiedAt.toISOString() }),
    ...(row.decidedAt === null ? {} : { decidedAt: row.decidedAt.toISOString() }),
    ...(row.decidedBy === null ? {} : { decidedBy: row.decidedBy }),
    ...(row.reason === null ? {} : { reason: row.reason }),
    ...(row.shopId === null ? {} : { shopId: asId<"ShopId">(row.shopId) }),
  };
}
