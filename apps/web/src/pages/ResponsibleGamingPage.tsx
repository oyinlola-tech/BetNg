import { Card, SectionHeader, SectionHeading, Skeleton, SkeletonRoot, SkeletonRows } from "@betng/ui-web";
import { DepositLimits, LimitHistory, LossLimits, ResponsibleGamingBanner, SelfExclusion, SessionLimits } from "../features/limits";
import { useLimitHistory, useLimitsSummary } from "../features/limits/limitQueries";
import { FlagGuard, ServiceError, isNotImplemented, ServiceUnavailable } from "../features/wallet/ServiceStates";
import { usePageMeta } from "../features/seo";
import { useAccountSignals } from "../hooks/accountQueries";

const BACK = { to: "/account", label: "Back to account" };

function LimitsSkeleton(): React.JSX.Element {
  return (
    <SkeletonRoot label="Loading limits" className="space-y-4">
      {[3, 2, 1].map((rows) => (
        <div key={rows} className="rounded-md border border-border bg-surface">
          <div className="border-b border-border px-4 py-3">
            <Skeleton className="h-3 w-28" />
          </div>
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-24" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      ))}
    </SkeletonRoot>
  );
}

function ResponsibleGaming(): React.JSX.Element {
  useAccountSignals();

  const summary = useLimitsSummary();
  const history = useLimitHistory();

  if (isNotImplemented(summary.error)) return <ServiceUnavailable back={BACK} />;

  if (summary.data === undefined) {
    return summary.isError ? (
      <Card padding="none">
        <ServiceError error={summary.error} onRetry={() => void summary.refetch()} back={BACK} />
      </Card>
    ) : (
      <LimitsSkeleton />
    );
  }

  const { limits, selfExclusion } = summary.data;

  return (
    <div className="space-y-5">
      <ResponsibleGamingBanner />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <DepositLimits limits={limits} />
          <LossLimits limits={limits} />
          <SessionLimits limits={limits} />
        </div>
        <div className="space-y-5">
          <SelfExclusion exclusion={selfExclusion} />
          <Card padding="none">
            <div className="border-b border-border px-4 py-3">
              <SectionHeading as="h2">Limit history</SectionHeading>
            </div>
            {history.data !== undefined ? (
              <LimitHistory entries={history.data} />
            ) : history.isError ? (
              <ServiceError error={history.error} onRetry={() => void history.refetch()} compact back={BACK} />
            ) : (
              <SkeletonRows rows={4} className="p-4" />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

export function ResponsibleGamingPage(): React.JSX.Element {
  usePageMeta({ title: "Responsible gaming", noindex: true });

  return (
    <div className="space-y-5">
      <SectionHeader as="h1" eyebrow="Account" title="Responsible gaming" />
      <FlagGuard
        flag="responsibleGamingEnabled"
        title="Limits are not available yet"
        description="Deposit, loss and session limits and self-exclusion are not switched on for BETNG yet."
        back={BACK}
      >
        <ResponsibleGaming />
      </FlagGuard>
    </div>
  );
}
