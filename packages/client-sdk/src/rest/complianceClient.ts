import { API_PREFIX } from "@betng/contracts/runtime";
import {
  adminPaymentSchema,
  kycDocumentPreviewSchema,
  kycReviewItemSchema,
  paymentOverviewSchema,
  responsibleGamingAccountSchema,
  type AdminPayment,
  type KycDocumentPreview,
  type KycReviewDecision,
  type KycReviewItem,
  type KycStatus,
  type PaymentDirection,
  type PaymentOverview,
  type PaymentStatus,
  type ResponsibleGamingAccount,
  type WithdrawalReview,
} from "@betng/contracts";
import { buildQuery, type Requester } from "./request.js";
import { validated, validatedPage, type PageShape } from "./validated.js";

export interface CompliancePageQuery {
  readonly page?: number;
  readonly pageSize?: number;
  readonly search?: string;
}

export interface AdminPaymentQuery extends CompliancePageQuery {
  readonly direction?: PaymentDirection;
  readonly status?: PaymentStatus;
  readonly provider?: string;
  readonly from?: string;
  readonly to?: string;
}

/** Operator views over KYC, payments and responsible gaming. Every decision is re-authorised and audit-logged by the platform. */
export interface BetNgComplianceClient {
  listKycQueue(query?: CompliancePageQuery & { readonly status?: KycStatus }): Promise<PageShape<KycReviewItem>>;
  reviewKyc(userId: string, decision: KycReviewDecision): Promise<KycReviewItem>;
  previewKycDocument(documentId: string): Promise<KycDocumentPreview>;
  getPaymentOverview(): Promise<PaymentOverview>;
  listPayments(query?: AdminPaymentQuery): Promise<PageShape<AdminPayment>>;
  reviewWithdrawal(reference: string, review: WithdrawalReview): Promise<AdminPayment>;
  listResponsibleGaming(query?: CompliancePageQuery & { readonly flag?: string }): Promise<PageShape<ResponsibleGamingAccount>>;
}

const n = (value: number | undefined): string | undefined => (value === undefined ? undefined : String(value));

export function createComplianceClient(request: Requester): BetNgComplianceClient {
  const base = `${API_PREFIX}/admin`;

  return {
    listKycQueue: async (query = {}) =>
      validatedPage(kycReviewItemSchema, await request("GET", `${base}/kyc/pending${buildQuery({ page: n(query.page), pageSize: n(query.pageSize), search: query.search, status: query.status })}`)),
    reviewKyc: async (userId, decision) => validated(kycReviewItemSchema, await request("POST", `${base}/kyc/review/${encodeURIComponent(userId)}`, decision)),
    previewKycDocument: async (documentId) => validated(kycDocumentPreviewSchema, await request("GET", `${base}/kyc/documents/${encodeURIComponent(documentId)}/preview`)),
    getPaymentOverview: async () => validated(paymentOverviewSchema, await request("GET", `${base}/payments/overview`)),
    listPayments: async (query = {}) =>
      validatedPage(
        adminPaymentSchema,
        await request(
          "GET",
          `${base}/payments${buildQuery({ page: n(query.page), pageSize: n(query.pageSize), search: query.search, direction: query.direction, status: query.status, provider: query.provider, from: query.from, to: query.to })}`,
        ),
      ),
    reviewWithdrawal: async (reference, review) => validated(adminPaymentSchema, await request("POST", `${base}/payments/withdrawals/${encodeURIComponent(reference)}/review`, review)),
    listResponsibleGaming: async (query = {}) =>
      validatedPage(responsibleGamingAccountSchema, await request("GET", `${base}/responsible-gaming${buildQuery({ page: n(query.page), pageSize: n(query.pageSize), search: query.search, flag: query.flag })}`)),
  };
}
