import type { KycOverview, KycRequirement, KycStatus, KycTier } from "@betng/contracts";
import { KYC_TIER_LIMITS } from "../../constants/index.js";
import type { KycDocument, KycIdentityCheck, KycProfile } from "../../generated/prisma/client.js";

const IDENTITY_DOCUMENTS: readonly string[] = ["NATIONAL_ID", "PASSPORT", "DRIVERS_LICENSE", "VOTERS_CARD"];

const TIERS: readonly KycTier[] = ["TIER_0", "TIER_1", "TIER_2", "TIER_3"];

function documentStatus(documents: readonly KycDocument[]): KycStatus {
  if (documents.length === 0) return "NOT_STARTED";
  if (documents.some((document) => document.status === "VERIFIED")) return "VERIFIED";
  if (documents.some((document) => document.status === "PENDING")) return "PENDING";
  if (documents.some((document) => document.status === "REQUIRES_ACTION" || document.status === "REJECTED")) return "REQUIRES_ACTION";

  return "NOT_STARTED";
}

const checkStatus = (checks: readonly KycIdentityCheck[], check: "BVN" | "NIN"): KycStatus =>
  checks.find((row) => row.check === check)?.status ?? "NOT_STARTED";

/**
 * Tier = number of verified pillars among BVN, NIN and an identity document; proof of address and a selfie are listed
 * once submitted. An operator's REJECT or REQUEST_ACTION stands until something new is submitted.
 */
export function computeKycOverview(
  documents: readonly KycDocument[],
  checks: readonly KycIdentityCheck[],
  profile: KycProfile | undefined,
): KycOverview {
  const requirements: KycRequirement[] = [
    { check: "BVN", status: checkStatus(checks, "BVN") },
    { check: "NIN", status: checkStatus(checks, "NIN") },
    { check: "DOCUMENT", status: documentStatus(documents.filter((document) => IDENTITY_DOCUMENTS.includes(document.type))) },
  ];

  const address = documents.filter((document) => document.type === "PROOF_OF_ADDRESS");
  const selfie = documents.filter((document) => document.type === "SELFIE");

  if (address.length > 0) requirements.push({ check: "ADDRESS", status: documentStatus(address) });
  if (selfie.length > 0) requirements.push({ check: "LIVENESS", status: documentStatus(selfie) });

  const pillars = requirements.slice(0, 3);
  const verified = pillars.filter((requirement) => requirement.status === "VERIFIED").length;
  const tier = TIERS[verified] ?? "TIER_0";
  const pending = requirements.some((requirement) => requirement.status === "PENDING");
  const newestSubmission = Math.max(0, ...documents.map((document) => document.uploadedAt.getTime()));
  const standingDecision =
    profile !== undefined && (profile.decision === "REJECTED" || profile.decision === "REQUIRES_ACTION") && profile.reviewedAt.getTime() >= newestSubmission
      ? profile
      : undefined;

  const status: KycStatus =
    verified === pillars.length
      ? "VERIFIED"
      : pending
        ? "PENDING"
        : standingDecision !== undefined
          ? standingDecision.decision
          : requirements.some((requirement) => requirement.status === "REQUIRES_ACTION")
            ? "REQUIRES_ACTION"
            : verified > 0
              ? "PENDING"
              : "NOT_STARTED";

  const limits = KYC_TIER_LIMITS[tier];

  return {
    status,
    tier,
    requirements,
    limits: { dailyDeposit: limits.dailyDeposit, dailyWithdrawal: limits.dailyWithdrawal },
    ...(profile === undefined ? {} : { reviewedAt: profile.reviewedAt.toISOString() }),
    ...(standingDecision?.reason === undefined || standingDecision.reason === null ? {} : { rejectionReason: standingDecision.reason.slice(0, 200) }),
  };
}

export async function loadKycOverview(
  store: { readonly kyc: { listDocuments(id: string): Promise<readonly KycDocument[]>; latestChecks(id: string): Promise<readonly KycIdentityCheck[]>; findProfile(id: string): Promise<KycProfile | undefined> } },
  customerId: string,
): Promise<{ readonly overview: KycOverview; readonly documents: readonly KycDocument[] }> {
  const [documents, checks, profile] = await Promise.all([
    store.kyc.listDocuments(customerId),
    store.kyc.latestChecks(customerId),
    store.kyc.findProfile(customerId),
  ]);

  return { overview: computeKycOverview(documents, checks, profile), documents };
}
