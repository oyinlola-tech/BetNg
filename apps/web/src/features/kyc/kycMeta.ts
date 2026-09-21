import { AlertTriangle, CheckCircle2, CircleDashed, Clock, XCircle, type LucideIcon } from "lucide-react";
import type { KycCheck, KycDocumentType, KycStatus, KycTier } from "@betng/contracts";
import type { StatusTone } from "@betng/ui-web";

export const KYC_STATUS: Readonly<Record<KycStatus, { readonly label: string; readonly tone: StatusTone; readonly icon: LucideIcon }>> = {
  NOT_STARTED: { label: "Not started", tone: "neutral", icon: CircleDashed },
  PENDING: { label: "In review", tone: "pending", icon: Clock },
  VERIFIED: { label: "Verified", tone: "success", icon: CheckCircle2 },
  REJECTED: { label: "Rejected", tone: "danger", icon: XCircle },
  REQUIRES_ACTION: { label: "Action needed", tone: "warning", icon: AlertTriangle },
};

export const KYC_TIER_LABEL: Readonly<Record<KycTier, string>> = { TIER_0: "Tier 0", TIER_1: "Tier 1", TIER_2: "Tier 2", TIER_3: "Tier 3" };

export const KYC_CHECK_LABEL: Readonly<Record<KycCheck, string>> = {
  BVN: "Bank Verification Number",
  NIN: "National Identification Number",
  DOCUMENT: "Identity document",
  ADDRESS: "Proof of address",
  LIVENESS: "Selfie check",
};

export const DOCUMENT_TYPES: readonly KycDocumentType[] = ["NATIONAL_ID", "PASSPORT", "DRIVERS_LICENSE", "VOTERS_CARD", "PROOF_OF_ADDRESS", "SELFIE"];

export const DOCUMENT_LABEL: Readonly<Record<KycDocumentType, string>> = {
  NATIONAL_ID: "National ID card",
  PASSPORT: "International passport",
  DRIVERS_LICENSE: "Driver's licence",
  VOTERS_CARD: "Voter's card",
  PROOF_OF_ADDRESS: "Proof of address",
  SELFIE: "Selfie",
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${String(Math.round(bytes / 1024))} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
