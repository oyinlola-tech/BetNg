import type { KycReviewItem } from "@betng/contracts";
import { toKycDocument } from "../../dtos/index.js";
import type { Customer } from "../../generated/prisma/client.js";
import type { IdentityStore } from "../../interfaces/index.js";
import { loadKycOverview } from "./kycOverview.helper.js";

export async function toKycReviewItem(store: IdentityStore, customer: Customer): Promise<KycReviewItem> {
  const { overview, documents } = await loadKycOverview(store, customer.id);
  const newest = documents.reduce<Date | undefined>((latest, document) => (latest === undefined || document.uploadedAt > latest ? document.uploadedAt : latest), undefined);

  return {
    userId: customer.id,
    displayName: customer.displayName,
    email: customer.email,
    status: overview.status,
    tier: overview.tier,
    submittedAt: (newest ?? customer.createdAt).toISOString(),
    documents: documents.map(toKycDocument),
  };
}
