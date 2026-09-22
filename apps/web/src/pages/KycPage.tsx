import { Card, SectionHeader, SectionHeading, SkeletonRows } from "@betng/ui-web";
import { DocumentList } from "../features/kyc/DocumentList";
import { DocumentUpload } from "../features/kyc/DocumentUpload";
import { IdentityCheckForm } from "../features/kyc/IdentityCheckForm";
import { KycOverviewCard, KycOverviewSkeleton } from "../features/kyc/KycOverviewCard";
import { useKycDocuments, useKycOverview } from "../features/kyc/kycQueries";
import { KYC_CHECK_LABEL } from "../features/kyc/kycMeta";
import { FlagGuard, ServiceError, isNotImplemented, ServiceUnavailable } from "../features/wallet/ServiceStates";
import { usePageMeta } from "../features/seo";

const BACK = { to: "/account", label: "Back to account" };

function Kyc(): React.JSX.Element {
  const overview = useKycOverview();
  const documents = useKycDocuments();

  if (isNotImplemented(overview.error)) return <ServiceUnavailable back={BACK} />;

  const needs = (check: "BVN" | "NIN"): boolean => overview.data?.requirements.find((r) => r.check === check)?.status !== "VERIFIED";

  return (
    <div className="space-y-5">
      {overview.data !== undefined ? (
        <KycOverviewCard overview={overview.data} />
      ) : overview.isError ? (
        <Card padding="none">
          <ServiceError error={overview.error} onRetry={() => void overview.refetch()} back={BACK} />
        </Card>
      ) : (
        <KycOverviewSkeleton />
      )}

      {overview.data !== undefined &&
        (["BVN", "NIN"] as const).filter(needs).map((check) => (
          <Card key={check}>
            <SectionHeading as="h2">{KYC_CHECK_LABEL[check]}</SectionHeading>
            <p className="type-small mt-1 mb-4 text-text-muted">Checked against the national record by the platform. The number is not stored on this device.</p>
            <IdentityCheckForm check={check} />
          </Card>
        ))}

      {overview.data !== undefined && (
        <Card>
          <SectionHeading as="h2">Upload a document</SectionHeading>
          <p className="type-small mt-1 mb-4 text-text-muted">A clear photo or scan of a valid document. It is sent straight to the platform for review.</p>
          <DocumentUpload />
        </Card>
      )}

      <Card padding="none">
        <div className="border-b border-border px-4 py-3">
          <SectionHeading as="h2">Your documents</SectionHeading>
        </div>
        {documents.data !== undefined ? (
          <DocumentList documents={documents.data} />
        ) : documents.isError ? (
          <ServiceError error={documents.error} onRetry={() => void documents.refetch()} compact back={BACK} />
        ) : (
          <SkeletonRows rows={3} className="p-4" />
        )}
      </Card>
    </div>
  );
}

export function KycPage(): React.JSX.Element {
  usePageMeta({ title: "Identity verification", noindex: true });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <SectionHeader as="h1" eyebrow="Account" title="Identity verification" />
      <FlagGuard flag="kycEnabled" title="Verification is not available yet" description="Identity verification is not switched on for BETNG yet. There is nothing you need to do." back={BACK}>
        <Kyc />
      </FlagGuard>
    </div>
  );
}
