import { Link } from "react-router";
import { IdCard } from "lucide-react";
import { DataSourceError } from "@betng/ui-core";
import { cn } from "@betng/ui-web";
import { paths } from "../../lib/paths";
import { LinkButton } from "../wallet/LinkButton";
import { useKycOverview } from "./kycQueries";

export function isKycRequired(error: unknown): boolean {
  return error instanceof DataSourceError && error.code === "KYC_REQUIRED";
}

/** The way forward when the platform answers KYC_REQUIRED; renders nothing for any other error. */
export function KycRequiredLink({ error, size = "sm", onNavigate }: { readonly error: unknown; readonly size?: "sm" | "md"; readonly onNavigate?: (() => void) | undefined }): React.JSX.Element | null {
  if (!isKycRequired(error)) return null;

  return (
    <LinkButton to={paths.kyc} size={size} onClick={onNavigate}>
      Verify your identity
    </LinkButton>
  );
}

const STATUS_COPY = {
  NOT_STARTED: "You have not verified your identity yet.",
  PENDING: "Your identity verification is in review.",
  REJECTED: "Your identity verification was not accepted.",
  REQUIRES_ACTION: "Your identity verification needs more from you.",
} as const;

/** Informational only: the platform decides whether an action needs verification and answers KYC_REQUIRED if so. */
export function KycStatusNotice({ action, className }: { readonly action: string; readonly className?: string }): React.JSX.Element | null {
  const overview = useKycOverview();
  const status = overview.data?.status;

  if (status === undefined || status === "VERIFIED") return null;

  return (
    <div role="status" className={cn("flex items-start gap-2.5 rounded-sm border border-info/40 bg-info-subtle px-3 py-2.5", className)} data-testid="kyc-status-notice">
      <IdCard className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
      <p className="type-small text-text-primary">
        {STATUS_COPY[status]} The platform may ask for verification before it completes {action}.{" "}
        <Link to={paths.kyc} className="rounded-xs font-semibold text-brand hover:underline focus-ring">
          Go to verification
        </Link>
      </p>
    </div>
  );
}
