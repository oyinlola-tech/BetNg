import { Link } from "react-router";
import { Gauge } from "lucide-react";
import type { LimitsSummary, ResponsibleGamingLimit } from "@betng/contracts";
import { formatMoney } from "@betng/ui-core";
import { cn } from "@betng/ui-web";
import { LIMIT_LABEL, LOSS_KINDS, formatLimitValue } from "./limitMeta";

/** Limits the platform reports as in force: every status but expired keeps the current value applying. */
export function limitsInForce(summary: LimitsSummary | undefined): readonly ResponsibleGamingLimit[] {
  return summary?.limits.filter((limit) => limit.status !== "expired") ?? [];
}

/** What the platform's own figures leave on a limit, or undefined when it did not report usage. */
export function remainingOn(limit: ResponsibleGamingLimit): number | undefined {
  return limit.used === undefined ? undefined : Math.max(0, limit.value - limit.used);
}

/** The tightest loss limit a stake would exceed, judged from the platform's last summary. Advisory only: the platform decides at placement. */
export function stakeOverLossLimit(summary: LimitsSummary | undefined, stake: number): { readonly limit: ResponsibleGamingLimit; readonly remaining: number } | undefined {
  let tightest: { readonly limit: ResponsibleGamingLimit; readonly remaining: number } | undefined;

  for (const limit of limitsInForce(summary)) {
    if (!LOSS_KINDS.includes(limit.kind)) continue;

    const remaining = remainingOn(limit);

    if (remaining === undefined || stake <= remaining) continue;
    if (tightest === undefined || remaining < tightest.remaining) tightest = { limit, remaining };
  }

  return tightest;
}

export function stakeLimitWarning(summary: LimitsSummary | undefined, stake: number): string | undefined {
  const over = stakeOverLossLimit(summary, stake);

  if (over === undefined) return undefined;

  return `This stake is more than the ${formatMoney(over.remaining)} left on your ${LIMIT_LABEL[over.limit.kind].toLowerCase()}. The platform may limit or refuse it.`;
}

export function LimitsStatus({ summary, className }: { readonly summary: LimitsSummary | undefined; readonly className?: string }): React.JSX.Element | null {
  const limits = limitsInForce(summary);

  if (limits.length === 0) return null;

  return (
    <section aria-labelledby="limits-status" className={cn("rounded-md border border-border bg-surface", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <h2 id="limits-status" className="type-section flex items-center gap-2">
          <Gauge className="size-3.5 text-text-muted" aria-hidden />
          Your limits
        </h2>
        <Link to="/responsible-gaming" className="type-small rounded-xs font-semibold text-brand hover:underline focus-ring">
          Manage limits
        </Link>
      </div>
      <dl className="grid divide-y divide-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3">
        {limits.map((limit) => {
          const remaining = remainingOn(limit);

          return (
            <div key={limit.kind} className="px-4 py-2.5" data-testid={`limit-status-${limit.kind}`}>
              <dt className="type-caption">{LIMIT_LABEL[limit.kind]}</dt>
              <dd className="mt-0.5 type-small text-text-secondary">
                {remaining === undefined ? (
                  <>
                    <span className="type-financial text-text-primary">{formatLimitValue(limit.kind, limit.value)}</span> limit
                  </>
                ) : (
                  <>
                    <span className="type-financial text-text-primary">{formatLimitValue(limit.kind, remaining)}</span> left of {formatLimitValue(limit.kind, limit.value)}
                  </>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
