import type { KycOverview } from "@betng/contracts";
import { formatDateTime, formatMoney } from "@betng/ui-core";
import { Card, Skeleton, SkeletonRoot } from "@betng/ui-web";
import { KYC_CHECK_LABEL, KYC_TIER_LABEL } from "./kycMeta";
import { KycStatusBadge } from "./KycStatusBadge";

export function KycOverviewSkeleton(): React.JSX.Element {
  return (
    <Card padding="none">
      <SkeletonRoot label="Loading verification status">
        <div className="flex items-start justify-between gap-3 p-5">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-32" />
          </div>
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="space-y-3 border-t border-border p-5">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex justify-between gap-4">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </SkeletonRoot>
    </Card>
  );
}

/** Status, tier and requirements exactly as the platform reports them. */
export function KycOverviewCard({ overview }: { readonly overview: KycOverview }): React.JSX.Element {
  const limits = overview.limits;

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4 md:p-5">
        <div>
          <p className="type-caption">Verification</p>
          <p className="type-h2 mt-1 text-text-primary">{KYC_TIER_LABEL[overview.tier]}</p>
          {overview.reviewedAt !== undefined && <p className="type-small mt-1 text-text-muted">Last reviewed {formatDateTime(overview.reviewedAt)}</p>}
        </div>
        <KycStatusBadge status={overview.status} className="text-base" />
      </div>
      {overview.rejectionReason !== undefined && (
        <p className="type-small mx-4 mb-3 rounded-sm border border-border bg-surface-sunken px-3 py-2 text-text-secondary md:mx-5">{overview.rejectionReason}</p>
      )}
      <ul className="divide-y divide-border border-t border-border" aria-label="Verification requirements">
        {overview.requirements.map((requirement) => (
          <li key={requirement.check} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 md:px-5">
            <span className="min-w-0">
              <span className="type-body block text-text-primary">{KYC_CHECK_LABEL[requirement.check]}</span>
              {requirement.message !== undefined && <span className="type-small block text-text-muted">{requirement.message}</span>}
            </span>
            <KycStatusBadge status={requirement.status} />
          </li>
        ))}
      </ul>
      {limits !== undefined && (limits.dailyDeposit !== undefined || limits.dailyWithdrawal !== undefined) && (
        <p className="type-small border-t border-border bg-surface-sunken px-4 py-3 text-text-secondary md:px-5">
          Your current tier allows
          {limits.dailyDeposit !== undefined && <> deposits up to <span className="type-financial text-text-primary">{formatMoney(limits.dailyDeposit)}</span> a day</>}
          {limits.dailyDeposit !== undefined && limits.dailyWithdrawal !== undefined && " and"}
          {limits.dailyWithdrawal !== undefined && <> withdrawals up to <span className="type-financial text-text-primary">{formatMoney(limits.dailyWithdrawal)}</span> a day</>}.
        </p>
      )}
    </Card>
  );
}
